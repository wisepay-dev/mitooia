import { NextRequest, NextResponse } from 'next/server';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';
import prisma from '@/app/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Security check: Validate that this browser session has the cookie for this upload
    const cookie = req.cookies.get(`upload_session_${id}`);
    if (!cookie || cookie.value !== 'true') {
      return NextResponse.json({ error: 'Unauthorized to view this preview' }, { status: 403 });
    }

    const upload = await prisma.upload.findUnique({ where: { id } });
    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const buffer = await StorageProvider.getUploadBufferByProvider(upload.storageProvider, upload.storageKey, upload.blobUrl || undefined);
    
    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      status: 200,
      headers: {
        'Content-Type': upload.mimeType,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Failed to load preview' }, { status: 500 });
  }
}
