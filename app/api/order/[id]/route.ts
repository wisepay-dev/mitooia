import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true, generations: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const payment = order.payments[0];
    const generation = order.generations[0];

    return NextResponse.json({
      status: order.status,
      qrCode: payment?.status === 'pending' ? payment?.providerId /* No banco de dados real precisariamos armazenar a string base64 se quisermos renderizar qrcode real. 
      Neste MVP, o create() já enviou o qrcode pro client. Aqui vamos apenas passar status. */ : null,
      generationId: generation?.id
    });

  } catch (error) {
    console.error('Order status error:', error);
    return NextResponse.json({ error: 'Erro ao verificar pedido' }, { status: 500 });
  }
}
