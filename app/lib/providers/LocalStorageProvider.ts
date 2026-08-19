import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class LocalStorageProvider {
  private static storageDir = path.join(process.cwd(), 'storage', 'uploads');

  static async init() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create storage directory', e);
    }
  }

  static async saveUpload(buffer: Buffer, mimeType: string): Promise<{ storageProvider: string, storageKey: string, blobUrl: string | null }> {
    await this.init();
    
    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `${crypto.randomUUID()}.${extension}`;
    const filePath = path.join(/*turbopackIgnore: true*/ this.storageDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    return {
      storageProvider: 'local',
      storageKey: filename,
      blobUrl: null
    };
  }

  static async getUploadBuffer(storageKey: string, blobUrl?: string): Promise<Buffer> {
    const filePath = path.join(this.storageDir, storageKey);
    return fs.readFile(filePath);
  }

  static async deleteUpload(storageKey: string, blobUrl?: string): Promise<void> {
    const filePath = path.join(this.storageDir, storageKey);
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.error('Failed to delete local upload', e);
    }
  }
}
