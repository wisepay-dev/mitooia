import { LocalStorageProvider } from './LocalStorageProvider';
import { VercelBlobStorageProvider } from './VercelBlobStorageProvider';

export class StorageProvider {
  private static getProvider() {
    if (process.env.STORAGE_PROVIDER === 'vercel-blob' || process.env.NODE_ENV === 'production') {
      return VercelBlobStorageProvider;
    }
    return LocalStorageProvider;
  }

  static async saveUpload(buffer: Buffer, mimeType: string): Promise<{ storageProvider: string, storageKey: string, blobUrl: string | null }> {
    return this.getProvider().saveUpload(buffer, mimeType);
  }

  static async getUploadBuffer(storageKey: string, blobUrl?: string | null): Promise<Buffer> {
    const provider = this.getProvider();
    // In case the DB has a vercel-blob but env says local (or vice versa),
    // we should ideally use the provider specified in the storageProvider parameter.
    // However, for simplicity and to match the interface, let's determine dynamically if possible, or just rely on env.
    // Actually, to be safer, let's take storageProvider as a parameter.
    return provider.getUploadBuffer(storageKey, blobUrl || undefined);
  }

  // Overload to explicitly fetch based on the DB record's provider
  static async getUploadBufferByProvider(providerName: string, storageKey: string, blobUrl?: string | null): Promise<Buffer> {
    if (providerName === 'vercel-blob') {
      return VercelBlobStorageProvider.getUploadBuffer(storageKey, blobUrl || undefined);
    }
    return LocalStorageProvider.getUploadBuffer(storageKey, blobUrl || undefined);
  }

  static async deleteUploadByProvider(providerName: string, storageKey: string, blobUrl?: string | null): Promise<void> {
    if (providerName === 'vercel-blob') {
      return VercelBlobStorageProvider.deleteUpload(storageKey, blobUrl || undefined);
    }
    return LocalStorageProvider.deleteUpload(storageKey, blobUrl || undefined);
  }
}
