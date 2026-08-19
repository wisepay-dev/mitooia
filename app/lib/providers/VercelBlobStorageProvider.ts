import { put, del } from '@vercel/blob';
import crypto from 'crypto';

export class VercelBlobStorageProvider {
  static async saveUpload(buffer: Buffer, mimeType: string): Promise<{ storageProvider: string, storageKey: string, blobUrl: string }> {
    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `uploads/${crypto.randomUUID()}.${extension}`;
    
    const { url, pathname } = await put(filename, buffer, {
      access: 'public', // Blob URLs are usually public, but we shouldn't expose them if possible. Let's use public for now as there's no native "private" without premium plan in some cases, or we can just rely on the random UUID for security.
      contentType: mimeType
    });

    return {
      storageProvider: 'vercel-blob',
      storageKey: pathname,
      blobUrl: url
    };
  }

  static async getUploadBuffer(storageKey: string, blobUrl?: string): Promise<Buffer> {
    if (!blobUrl) throw new Error('Vercel Blob URL is missing');
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error(`Failed to fetch blob: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  static async deleteUpload(storageKey: string, blobUrl?: string): Promise<void> {
    if (blobUrl) {
      await del(blobUrl);
    }
  }
}
