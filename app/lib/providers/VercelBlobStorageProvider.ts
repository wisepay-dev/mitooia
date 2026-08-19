import { put, del, get } from '@vercel/blob';
import crypto from 'crypto';

export class VercelBlobStorageProvider {
  static async saveUpload(buffer: Buffer, mimeType: string): Promise<{ storageProvider: string, storageKey: string, blobUrl: string }> {
    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `uploads/${crypto.randomUUID()}.${extension}`;
    
    const { url, pathname } = await put(filename, buffer, {
      access: 'private',
      contentType: mimeType
    });

    return {
      storageProvider: 'vercel-blob',
      storageKey: pathname,
      blobUrl: url
    };
  }

  static async getUploadBuffer(storageKey: string, blobUrl?: string): Promise<Buffer> {
    const target = blobUrl || storageKey;
    if (!target) throw new Error('Vercel Blob URL or Key is missing');
    
    const result = await get(target, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    if (!result || !result.stream) {
      throw new Error('Failed to fetch blob or stream is null');
    }

    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  static async deleteUpload(storageKey: string, blobUrl?: string): Promise<void> {
    if (blobUrl) {
      await del(blobUrl);
    }
  }
}
