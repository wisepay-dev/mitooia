import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { ImageGenerationProvider, ScenarioTheme } from '@/app/lib/providers/ImageGenerationProvider';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Pedido inválido', code: 'ORDER_NOT_FOUND' }, { status: 400 });
    }

    // Valida Pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { credits: true, generations: { include: { upload: true } } }
    });

    if (!order || order.status !== 'PAID') {
      return NextResponse.json({ error: 'Pedido não encontrado ou não pago', code: 'ORDER_NOT_FOUND' }, { status: 404 });
    }

    // Concurrency / Idempotency Check
    const processingGeneration = order.generations.find(g => g.status === 'PROCESSING');
    if (processingGeneration) {
      return NextResponse.json({ success: true, status: 'PROCESSING' });
    }

    const completedGeneration = order.generations.find(g => g.status === 'SUCCESS' || g.status === 'COMPLETED');
    if (completedGeneration) {
      return NextResponse.json({ success: true, generationId: completedGeneration.id, status: completedGeneration.status });
    }

    // Valida Crédito
    const availableCredit = order.credits.find(c => c.amount > c.used);
    if (!availableCredit) {
      return NextResponse.json({ error: 'Sem créditos disponíveis', code: 'NO_CREDIT' }, { status: 403 });
    }

    // Busca a Geração pendente
    const generation = order.generations.find(g => g.status === 'READY' || g.status === 'FAILED');
    if (!generation) {
      return NextResponse.json({ error: 'Nenhuma geração pronta para iniciar' }, { status: 400 });
    }

    // Reserva atômica: marca geração como PROCESSING e desconta o crédito
    await prisma.$transaction([
      prisma.generation.update({
        where: { id: generation.id },
        data: { status: 'PROCESSING' }
      }),
      prisma.generationCredit.update({
        where: { id: availableCredit.id },
        data: { used: availableCredit.used + 1 }
      })
    ]);

    let result;
    try {
      // Recupera a foto enviada
      const uploadBuffer = await StorageProvider.getUploadBufferByProvider(
        generation.upload.storageProvider,
        generation.upload.storageKey,
        generation.upload.blobUrl
      );

      // Geração
      result = await ImageGenerationProvider.generate({
        orderId,
        generationId: generation.id,
        uploadBuffer,
        mimeType: generation.upload.mimeType,
        scenario: generation.scenarioId as ScenarioTheme
      });

    } catch (e: any) {
      console.error('[GENERATION] provider_failed', {
        orderId,
        model: process.env.OPENAI_IMAGE_MODEL || 'default',
        providerStatus: 502,
        providerCode: e.code || 'UNKNOWN'
      });

      // SE FALHA: marcar tentativa FAILED, devolver o crédito
      await prisma.$transaction([
        prisma.generation.update({
          where: { id: generation.id },
          data: { status: 'FAILED' }
        }),
        prisma.generationCredit.update({
          where: { id: availableCredit.id },
          data: { used: { decrement: 1 } }
        })
      ]);

      return NextResponse.json({
        success: false,
        error: "IMAGE_PROVIDER_ERROR",
        message: "Não foi possível gerar sua imagem. Seu crédito foi mantido. Tente novamente."
      }, { status: 502 });
    }

    // Atualiza status final
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: result.status,
        imageUrl: result.imageUrl,
        estimatedCostUsd: result.costUsd
      }
    });

    return NextResponse.json({ success: true, generationId: generation.id, status: result.status });

  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Falha ao gerar imagem' }, { status: 500 });
  }
}
