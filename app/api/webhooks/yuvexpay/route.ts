import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';

// Replay protection window (300 seconds as per YuvexPay docs)
const MAX_REPLAY_WINDOW_MS = 300 * 1000;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text(); // Raw body is required for signature verification
    const timestampStr = req.headers.get('X-Webhook-Timestamp');
    const signature = req.headers.get('X-Webhook-Signature');
    const deliveryId = req.headers.get('X-Webhook-Delivery-Id');

    if (!timestampStr || !signature || !deliveryId) {
      return NextResponse.json({ error: 'Missing security headers' }, { status: 400 });
    }

    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    // 1. Replay Protection
    if (Math.abs(now - timestamp) > MAX_REPLAY_WINDOW_MS) {
      return NextResponse.json({ error: 'Webhook timestamp expired (replay protection)' }, { status: 400 });
    }

    // 2. Signature Verification
    const secret = process.env.YUVEX_WEBHOOK_SECRET;
    if (!secret) {
      console.error('CRITICAL: YUVEX_WEBHOOK_SECRET is not defined');
      return NextResponse.json({ error: 'Internal configuration error' }, { status: 500 });
    }

    const signedPayload = `${timestampStr}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (
      expectedSignature.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
    ) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Deduplication (At-least-once delivery)
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: 'YUVEXPAY',
          deliveryId: deliveryId,
          eventType: 'unknown', // will update after parsing
          payload: rawBody
        }
      });
    } catch (e: any) {
      // If unique constraint fails, it means we already processed this deliveryId
      if (e.code === 'P2002') {
        console.log(`[YUVEXPAY WEBHOOK] Duplicate delivery detected: ${deliveryId}. Ignoring.`);
        return NextResponse.json({ received: true, duplicated: true });
      }
      throw e;
    }

    // 4. Parse Payload
    const data = JSON.parse(rawBody);
    const { event, data: paymentData } = data;

    // Update event type in the WebhookEvent record we just created
    await prisma.webhookEvent.update({
      where: { deliveryId },
      data: { eventType: event }
    });

    if (event !== 'PAYMENT_PAID') {
      // We acknowledge the webhook, but we don't act on other events yet for the MVP
      return NextResponse.json({ received: true });
    }

    // 5. Locate Payment & Validate amount
    const externalId = paymentData.externalId;
    if (!externalId) {
      return NextResponse.json({ error: 'Missing externalId' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: externalId },
      include: { credits: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // CRITICAL: Amount validation. The paymentData.amount from YuvexPay is 4.90. Our order totalAmount is 490.
    const expectedAmount = 4.90;
    if (paymentData.amount !== expectedAmount || paymentData.currency !== 'BRL') {
      console.error(`[YUVEXPAY WEBHOOK] Amount mismatch! Expected 4.90 BRL, got ${paymentData.amount} ${paymentData.currency}`);
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // YuvexPay statuses: PAID means the money is fully credited
    if (paymentData.status !== 'PAID') {
      return NextResponse.json({ error: 'Event mismatch: PAYMENT_PAID but status is not PAID' }, { status: 400 });
    }

    // 6. Idempotent Release
    // Update Payment
    await prisma.payment.updateMany({
      where: { providerPaymentId: paymentData.id, provider: 'YUVEXPAY' },
      data: { 
        status: 'PAID', 
        paidAt: new Date()
      }
    });

    // If order is not already PAID, release the credit
    if (order.status !== 'PAID') {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID' }
        }),
        prisma.generationCredit.create({
          data: {
            orderId: order.id,
            amount: 1
          }
        }),
        prisma.generation.updateMany({
          where: { orderId: order.id, status: 'WAITING_PAYMENT' },
          data: { status: 'READY' }
        })
      ]);
      console.log(`[YUVEXPAY WEBHOOK] Order ${order.id} PAID. GenerationCredit created.`);
    } else {
      console.log(`[YUVEXPAY WEBHOOK] Order ${order.id} was already PAID. No extra credit generated.`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[YUVEXPAY WEBHOOK] Internal error:', error);
    return NextResponse.json({ error: 'Internal Processing Error' }, { status: 500 });
  }
}
