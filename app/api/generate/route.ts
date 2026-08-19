import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { ImageGenerationProvider, ScenarioTheme } from '@/app/lib/providers/ImageGenerationProvider';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    // Valida Pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { credits: true, generations: { include: { upload: true } } }
    });

    if (!order || order.status !== 'PAID') {
      return NextResponse.json({ error: 'Pagamento não confirmado' }, { status: 403 });
    }

    // Valida Crédito
    const availableCredit = order.credits.find(c => c.amount > c.used);
    if (!availableCredit) {
      return NextResponse.json({ error: 'Sem créditos disponíveis' }, { status: 403 });
    }

    // Busca a Geração pendente
    const generation = order.generations.find(g => g.status === 'READY');
    if (!generation) {
      return NextResponse.json({ error: 'Nenhuma geração pronta para iniciar' }, { status: 400 });
    }

    // Reserva atômica: marca geração como PROCESSING
    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: 'PROCESSING' }
    });

    // Desconta crédito
    await prisma.generationCredit.update({
      where: { id: availableCredit.id },
      data: { used: availableCredit.used + 1 }
    });

    // Recupera a foto enviada
    const uploadBuffer = await StorageProvider.getUploadBufferByProvider(
      generation.upload.storageProvider,
      generation.upload.storageKey,
      generation.upload.blobUrl
    );

    // Geração
    const result = await ImageGenerationProvider.generate({
      uploadBuffer,
      mimeType: generation.upload.mimeType,
      scenario: generation.scenarioId as ScenarioTheme
    });

    // Atualiza status final
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: result.status,
        imageUrl: result.imageUrl,
        estimatedCostUsd: result.costUsd
      }
    });

    return NextResponse.json({ success: true, generationId: generation.id });

  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Falha ao gerar imagem' }, { status: 500 });
  }
}
