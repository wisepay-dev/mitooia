import { NextRequest, NextResponse } from 'next/server';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';
import prisma from '@/app/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename: id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Attempt to find by Generation ID
    const generation = await prisma.generation.findUnique({ where: { id } });
    let buffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    if (generation && generation.imageUrl) {
      const url = generation.imageUrl;
      if (url.startsWith('local://')) {
        buffer = await StorageProvider.getUploadBufferByProvider('local', url.replace('local://', ''));
        mimeType = 'image/png';
      } else {
        // Vercel Blob URL (private)
        // We use the provider to fetch it securely using token
        buffer = await StorageProvider.getUploadBufferByProvider('vercel-blob', '', url);
        mimeType = 'image/png';
      }
    } else {
      // Fallback: Check if it's an Upload ID
      const upload = await prisma.upload.findUnique({ where: { id } });
      if (upload) {
        buffer = await StorageProvider.getUploadBufferByProvider(upload.storageProvider, upload.storageKey, upload.blobUrl);
        mimeType = upload.mimeType;
      }
    }

    if (!buffer) {
      return NextResponse.json({ error: 'Image content not found' }, { status: 404 });
    }

    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
