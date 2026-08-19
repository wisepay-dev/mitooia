import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: generationId } = await params;
    if (!generationId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const generation = await prisma.generation.findUnique({
      where: { id: generationId }
    });

    if (!generation) {
      return NextResponse.json({ error: 'Geração não encontrada' }, { status: 404 });
    }

    let url = generation.imageUrl;
    // Map local path to an API endpoint so the frontend can display it
    if (url && url.startsWith('local://')) {
      url = `/api/images/${url.replace('local://', '')}`;
    }

    return NextResponse.json({
      status: generation.status,
      imageUrl: url
    });

  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
