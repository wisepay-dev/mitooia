import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { YuvexPayProvider } from '@/app/lib/providers/YuvexPayProvider';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 1 & 3: Localizar Order e Payment
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true, credits: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // 6. Se já estiver PAID, retornar sucesso sem executar de novo
    if (order.status === 'PAID' || order.status === 'COMPLETED') {
      return NextResponse.json({ success: true, paid: true, status: 'PAID' });
    }

    const payment = order.payments.find(p => p.provider === 'YUVEXPAY');
    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    const providerPaymentId = payment.providerPaymentId;
    if (!providerPaymentId) {
      return NextResponse.json({ error: 'ID do provedor não encontrado' }, { status: 400 });
    }

    // 4. Consultar Yuvex
    // Passamos o valor totalAmount em decimal esperado. amount na DB está em reais se foi 4.90.
    const expectedAmount = 4.90; // The prompt explicitly used 4.90 or 4.01 via heuristics.
    
    // We determine the expected amount logic:
    // If the payment in DB says 4.01, we pass 4.01. Wait, does Payment have amount?
    // Let's check Prisma schema. Yes, Payment has amount.
    const paymentAmount = payment.amount || 4.90;

    let remotePayment;
    try {
      remotePayment = await YuvexPayProvider.getPayment(providerPaymentId, paymentAmount);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }

    // 5. Validar correspondência
    if (remotePayment.id !== providerPaymentId) {
      return NextResponse.json({ error: 'ID mismatch' }, { status: 400 });
    }

    if (remotePayment.externalId && remotePayment.externalId !== order.id) {
      return NextResponse.json({ error: 'External ID mismatch' }, { status: 400 });
    }

    if (remotePayment.amount !== paymentAmount) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // 7. Quando não estiver PAID
    if (remotePayment.status !== 'PAID') {
      return NextResponse.json({ 
        success: true, 
        paid: false, 
        status: remotePayment.status || 'NEW' 
      });
    }

    // 6. Quando status for PAID
    // Idempotent Release Transaction (same as webhook)
    await prisma.payment.updateMany({
      where: { id: payment.id },
      data: { 
        status: 'PAID', 
        paidAt: new Date()
      }
    });

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID' }
      }),
      // Guarantee exactly 1 generation credit total
      ...(order.credits.length === 0 ? [
        prisma.generationCredit.create({
          data: {
            orderId: order.id,
            amount: 1
          }
        })
      ] : []),
      prisma.generation.updateMany({
        where: { orderId: order.id, status: 'WAITING_PAYMENT' },
        data: { status: 'READY' }
      })
    ]);

    return NextResponse.json({ success: true, paid: true, status: 'PAID' });

  } catch (error) {
    console.error('Reconcile error:', error);
    return NextResponse.json({ error: 'Erro ao reconciliar pagamento' }, { status: 500 });
  }
}
