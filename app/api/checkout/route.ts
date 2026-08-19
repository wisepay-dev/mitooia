import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { PaymentProvider } from '@/app/lib/providers/PaymentProvider';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uploadId, scenarioId, utmSource, utmMedium, utmCampaign, utmContent, fbclid } = body;

    console.info("[CHECKOUT] request", {
      uploadId,
      scenarioId
    });

    if (!uploadId) {
      console.error("[CHECKOUT] rejected", { reason: "MISSING_UPLOAD_ID" });
      return NextResponse.json({ error: "MISSING_UPLOAD_ID", message: "uploadId is required" }, { status: 400 });
    }

    if (!scenarioId) {
      console.error("[CHECKOUT] rejected", { reason: "MISSING_SCENARIO_ID" });
      return NextResponse.json({ error: "MISSING_SCENARIO_ID", message: "scenarioId is required" }, { status: 400 });
    }

    // Valida se o upload existe
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) {
      return NextResponse.json({ error: 'Upload não encontrado' }, { status: 404 });
    }

    // Cria a Order
    const order = await prisma.order.create({
      data: {
        totalAmount: 490, // R$ 4,90
        status: 'WAITING_PAYMENT',
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        fbclid,
      }
    });

    // Cria a intenção de pagamento no provedor sem email
    const pixData = await PaymentProvider.createPixPayment(order.id, 490);

    // Salva o registro de pagamento atrelado à Order
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'YUVEXPAY',
        providerPaymentId: pixData.id,
        amount: 4.90, // YuvexPay uses float/decimal
        status: pixData.status || 'NEW',
        method: 'PIX',
        currency: 'BRL'
      }
    });

    // Cria a Geração em estado READY aguardando pagamento
    await prisma.generation.create({
      data: {
        orderId: order.id,
        uploadId: upload.id,
        scenarioId: scenarioId,
        status: 'WAITING_PAYMENT'
      }
    });

    return NextResponse.json({ 
      success: true, 
      orderId: order.id,
      qrCode: pixData.qrCode,
      qrCodeBase64: pixData.qrCodeBase64
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Falha ao iniciar checkout' }, { status: 500 });
  }
}
