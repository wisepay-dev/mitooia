import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class StorageProvider {
  private static storageDir = path.join(process.cwd(), 'storage', 'uploads');

  static async init() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create storage directory', e);
    }
  }

  static async saveUpload(buffer: Buffer, mimeType: string): Promise<string> {
    await this.init();
    
    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `${crypto.randomUUID()}.${extension}`;
    const filePath = path.join(/*turbopackIgnore: true*/ this.storageDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    // Returns an internal reference path, NOT a public URL
    return `local://${filename}`;
  }

  static async getUploadBuffer(internalUrl: string): Promise<Buffer> {
    if (!internalUrl.startsWith('local://')) {
      throw new Error('Invalid internal URL format');
    }
    
    const filename = internalUrl.replace('local://', '');
    const filePath = path.join(this.storageDir, filename);
    
    return fs.readFile(filePath);
  }
}
