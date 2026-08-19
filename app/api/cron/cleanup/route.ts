import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { StorageProvider } from '@/app/lib/providers/StorageProvider';

export async function GET() {
  try {
    const expiredUploads = await prisma.upload.findMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    let deletedCount = 0;

    for (const upload of expiredUploads) {
      try {
        await StorageProvider.deleteUploadByProvider(
          upload.storageProvider,
          upload.storageKey,
          upload.blobUrl
        );

        await prisma.upload.delete({
          where: { id: upload.id }
        });
        
        deletedCount++;
      } catch (e) {
        console.error(`Failed to cleanup upload ${upload.id}`, e);
      }
    }

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ error: 'Falha no cleanup' }, { status: 500 });
  }
}
