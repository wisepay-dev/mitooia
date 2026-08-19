import { NextRequest, NextResponse } from 'next/server';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const buffer = await StorageProvider.getUploadBuffer(`local://${filename}`);
    
    // Determine mime type from extension
    let mimeType = 'image/jpeg';
    if (filename.endsWith('.png')) mimeType = 'image/png';
    if (filename.endsWith('.webp')) mimeType = 'image/webp';

    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
