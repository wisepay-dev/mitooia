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
      include: {
        generations: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'ORDER_NOT_FOUND' }, { status: 404 });
    }

    const generation = order.generations[0];

    if (!generation || generation.status === 'READY') {
      return NextResponse.json({ success: true, status: 'PENDING' }, { status: 200 });
    }

    if (generation.status === 'PROCESSING') {
      return NextResponse.json({ success: true, status: 'PROCESSING' }, { status: 200 });
    }

    if (generation.status === 'FAILED') {
      return NextResponse.json({ success: false, status: 'FAILED', error: 'IMAGE_PROVIDER_ERROR' }, { status: 200 });
    }

    if (generation.status === 'COMPLETED' || generation.status === 'SUCCESS') {
      let url = generation.imageUrl ? `/api/images/${generation.id}` : null;
      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
        hasResult: !!url,
        imageUrl: url,
        generationId: generation.id,
        version: generation.updatedAt.getTime()
      }, { status: 200 });
    }

    // Default fallback
    return NextResponse.json({ success: true, status: generation.status }, { status: 200 });

  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
