import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    console.log('[UPLOAD] request started');
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.log('[UPLOAD] validation failed: Nenhuma foto enviada');
      return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB)' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não suportado. Use JPG, PNG ou WEBP' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Save locally
    const internalUrl = await StorageProvider.saveUpload(buffer, file.type);

    // Save to DB
    const upload = await prisma.upload.create({
      data: {
        url: internalUrl,
        mimeType: file.type,
        status: 'PENDING'
      }
    });

    console.log('[UPLOAD] response sent with uploadId:', upload.id);

    return NextResponse.json({ 
      success: true, 
      uploadId: upload.id,
      status: 'UPLOADED'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Falha no servidor ao processar imagem' }, { status: 500 });
  }
}
