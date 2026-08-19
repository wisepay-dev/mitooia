import { NextRequest, NextResponse } from 'next/server';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';
import prisma from '@/app/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { generations: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const generation = order.generations[0];
    if (!generation || (generation.status !== 'COMPLETED' && generation.status !== 'SUCCESS')) {
      return NextResponse.json({ error: 'Image not ready' }, { status: 404 });
    }

    if (!generation.imageUrl) {
      return NextResponse.json({ error: 'Image content missing' }, { status: 404 });
    }

    let buffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    const url = generation.imageUrl;

    console.log('[RESULT DELIVERY] fetching blob', {
      orderId,
      generationId: generation.id,
      hasResult: true,
      hasResultReference: true,
      storageProvider: url.startsWith('local://') ? 'local' : 'vercel-blob'
    });

    if (url.startsWith('local://')) {
      buffer = await StorageProvider.getUploadBufferByProvider('local', url.replace('local://', ''));
      mimeType = 'image/png';
    } else {
      buffer = await StorageProvider.getUploadBufferByProvider('vercel-blob', '', url);
      mimeType = 'image/png';
    }

    if (!buffer) {
      return NextResponse.json({ error: 'Image content not found' }, { status: 404 });
    }

    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=86400'
      }
    });
  } catch (error) {
    console.error('Result image error:', error);
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
