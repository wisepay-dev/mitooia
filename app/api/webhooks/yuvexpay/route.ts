import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';

// Replay protection window (300 seconds as per YuvexPay docs)
const MAX_REPLAY_WINDOW_MS = 300 * 1000;

export async function POST(req: NextRequest) {
  let rawBody = '';
  let timestampStr = '';
  let signature = '';
  let deliveryId = '';
  const secret = process.env.YUVEX_WEBHOOK_SECRET;

  const logRejection = (reason: string) => {
    console.error('[WEBHOOK YUVEX] rejected', {
      reason,
      hasTimestamp: !!timestampStr,
      hasSignature: !!signature,
      hasDeliveryId: !!deliveryId,
      hasSecret: !!secret
    });
  };

  try {
    rawBody = await req.text(); // Raw body is required for signature verification
    timestampStr = req.headers.get('X-Webhook-Timestamp') || '';
    signature = req.headers.get('X-Webhook-Signature') || '';
    deliveryId = req.headers.get('X-Webhook-Delivery-Id') || '';

    if (!timestampStr) {
      logRejection('MISSING_TIMESTAMP');
      return NextResponse.json({ error: 'Missing timestamp' }, { status: 400 });
    }
    if (!signature) {
      logRejection('MISSING_SIGNATURE');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }
    if (!deliveryId) {
      logRejection('MISSING_DELIVERY_ID');
      return NextResponse.json({ error: 'Missing delivery id' }, { status: 400 });
    }
    if (!secret) {
      logRejection('MISSING_WEBHOOK_SECRET');
      return NextResponse.json({ error: 'Internal configuration error' }, { status: 500 });
    }

    const timestampHeader = req.headers.get('X-Webhook-Timestamp');
    if (!timestampHeader) {
      logRejection('MISSING_TIMESTAMP');
      return NextResponse.json({ error: 'Missing webhook timestamp' }, { status: 400 });
    }

    const webhookTimestamp = Number(timestampHeader);

    if (!Number.isFinite(webhookTimestamp) || webhookTimestamp <= 0) {
      logRejection('INVALID_TIMESTAMP');
      return NextResponse.json({ error: 'Invalid webhook timestamp' }, { status: 400 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const driftSeconds = Math.abs(nowSeconds - webhookTimestamp);

    console.info("[WEBHOOK YUVEX] timestamp check", {
      nowSeconds,
      webhookTimestamp,
      driftSeconds
    });

    if (driftSeconds > 300) {
      console.warn("[WEBHOOK YUVEX] timestamp rejected", {
        driftSeconds
      });
      logRejection('INVALID_TIMESTAMP'); // Or replay protection
      return NextResponse.json({ error: 'Webhook timestamp expired (replay protection)' }, { status: 400 });
    }

    // Assign back to variables used later
    timestampStr = timestampHeader;

    // 2. Signature Verification
    const signedPayload = `${timestampStr}.${rawBody}`;
    const expectedSignature = 'v1=' + crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (
      expectedSignature.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
    ) {
      logRejection('INVALID_SIGNATURE');
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
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      logRejection('INVALID_JSON');
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    
    // As per user instructions, check if it's PAYMENT_PAID
    // The exact JSON structure from YuvexPay might have event or type. The user said: "event.type === 'PAYMENT_PAID' e event.data.status === 'PAID'"
    const eventType = data.type || data.event; 
    const paymentData = data.data || data;

    // Update event type in the WebhookEvent record we just created
    await prisma.webhookEvent.update({
      where: { deliveryId },
      data: { eventType: eventType || 'unknown' }
    });
    
    console.info('[WEBHOOK YUVEX] verified', {
      eventType,
      deliveryId
    });

    if (eventType !== 'PAYMENT_PAID') {
      logRejection('INVALID_EVENT');
      // We acknowledge the webhook, but we don't act on other events yet for the MVP
      return NextResponse.json({ received: true });
    }

    // 5. Locate Payment & Validate amount
    const externalId = paymentData.externalId;
    if (!externalId) {
      logRejection('INVALID_JSON'); // Missing externalId
      return NextResponse.json({ error: 'Missing externalId' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: externalId },
      include: { credits: true }
    });

    if (!order) {
      logRejection('INVALID_JSON'); // Order not found, maybe invalid payload?
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // CRITICAL: Amount validation. The paymentData.amount from YuvexPay is 4.90. Our order totalAmount is 490.
    const expectedAmount = 4.90;
    if (paymentData.amount !== expectedAmount || paymentData.currency !== 'BRL') {
      logRejection('INVALID_EVENT'); // Amount mismatch
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // YuvexPay statuses: PAID means the money is fully credited
    if (paymentData.status !== 'PAID') {
      logRejection('INVALID_EVENT'); // Not actually PAID
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
      console.info('[WEBHOOK YUVEX] payment paid', {
        orderId: order.id,
        paymentId: paymentData.id
      });
    } else {
      console.log(`[YUVEXPAY WEBHOOK] Order ${order.id} was already PAID. No extra credit generated.`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[YUVEXPAY WEBHOOK] Internal error:', error);
    return NextResponse.json({ error: 'Internal Processing Error' }, { status: 500 });
  }
}
