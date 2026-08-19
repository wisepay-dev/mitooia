import OpenAI, { toFile } from 'openai';
import { StorageProvider } from './StorageProvider';

const isEnabled = process.env.IMAGE_GENERATION_ENABLED === 'true';
const hasKey = !!process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (isEnabled && hasKey) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export type ScenarioTheme = 
  | 'selfie'
  | 'comicio'
  | 'poster';

interface GenerationInput {
  orderId: string;
  generationId: string;
  uploadBuffer: Buffer;
  mimeType: string;
  scenario: ScenarioTheme;
}

interface ProviderCapability {
  supportsImageInput: boolean;
  supportsInputFidelity: boolean;
  supportsImageEditing: boolean;
}

const MODEL_CAPABILITIES: Record<string, ProviderCapability> = {
  'dall-e-3': {
    supportsImageInput: false,
    supportsInputFidelity: false,
    supportsImageEditing: false
  },
  'gpt-image-1.5': {
    supportsImageInput: true,
    supportsInputFidelity: true,
    supportsImageEditing: true
  }
};

export class ImageGenerationProvider {
  /**
   * Translates the scenario into a high-fidelity photographic prompt.
   */
  private static getPromptForScenario(scenario: ScenarioTheme): string {
    switch (scenario) {
      case 'selfie':
        return "Edit the provided user photo into a realistic photographic montage. Preserve the user’s face, identity, skin tone, hairstyle, and key facial traits as faithfully as possible. Create a natural-looking photo with the user and Jair Bolsonaro together in the same scene. The result must look like a realistic themed photo, not an illustration, cartoon, painting, or poster. Keep the user recognizable as the same person from the uploaded selfie. Use realistic lighting, realistic skin texture, and a believable Brazilian patriotic setting with subtle green and yellow elements. Bolsonaro should appear clearly and recognizably next to the user. The composition should feel like a real photo taken in person.";
      case 'comicio':
        return "Edit the uploaded user photo into a realistic photographic composition. Preserve the user’s identity with high fidelity. Place the user in a large Brazilian patriotic rally scene with green and yellow flags and Jair Bolsonaro visibly present in the same scene. The final result must look like a believable real photo montage, not a poster, digital painting, or stylized illustration. Keep realistic lighting, realistic facial detail, and a natural blend between the original user and the generated environment.";
      case 'poster':
        return "Edit the uploaded user photo into a cinematic, high-impact photo composition while preserving the user’s face and identity as faithfully as possible. Include Jair Bolsonaro in the composition in a realistic and recognizable way. Use dramatic but realistic lighting and a cinematic atmosphere. The result should look like a premium cinematic photo composite, not a cartoon or painted poster. The uploaded user must remain clearly recognizable.";
      default:
        console.warn(`[WARNING] Fallback to default prompt! Unrecognized scenario: ${scenario}`);
        return "Edit the provided user photo into a realistic photographic montage. Preserve the user’s face and identity faithfully. Create a natural-looking photo with the user and Jair Bolsonaro together. The result must look like a realistic photo, not an illustration, cartoon, painting, or poster. Keep the user recognizable. Use realistic lighting and realistic skin texture.";
    }
  }

  static async generate(input: GenerationInput): Promise<{ imageUrl: string, costUsd: number, status: string }> {
    if (!isEnabled || !hasKey || !openai) {
      console.log('[MOCK] Generating fake image for scenario:', input.scenario);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return {
        imageUrl: 'local://mock-generated-image.jpg',
        costUsd: 0,
        status: 'COMPLETED'
      };
    }

    try {
      const model = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
      const prompt = this.getPromptForScenario(input.scenario);
      const capabilities = MODEL_CAPABILITIES[model] || {
        supportsImageInput: false,
        supportsInputFidelity: false,
        supportsImageEditing: false
      };

      console.log('[GENERATION INPUT]', {
        orderId: input.orderId,
        uploadId: 'from-provider',
        hasUserImage: !!input.uploadBuffer,
        userImageMime: input.mimeType,
        userImageBytes: input.uploadBuffer?.length || 0,
        scenarioKey: input.scenario
      });

      if (!input.uploadBuffer || input.uploadBuffer.length === 0) {
        const error = new Error('Selfie is required for generation but was not found.');
        (error as any).code = 'GENERATION_INPUT_MISSING';
        throw error;
      }

      console.log('[GENERATION OPENAI REQUEST]', {
        orderId: input.orderId,
        model,
        operation: capabilities.supportsImageEditing ? 'edit' : 'generate',
        scenarioKey: input.scenario,
        hasUserImage: true,
        userImageBytes: input.uploadBuffer.length,
        inputImageCount: 1,
        inputFidelity: capabilities.supportsInputFidelity ? 'high' : 'unsupported'
      });

      if (!capabilities.supportsImageInput) {
        const error = new Error(`Model ${model} does not support image input natively. Aborting to prevent random generation.`);
        (error as any).code = 'GENERATION_INPUT_MISSING';
        throw error;
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(input.mimeType)) {
        const error = new Error(`Unsupported image format: ${input.mimeType}. Supported formats: image/jpeg, image/png, image/webp.`);
        (error as any).code = 'GENERATION_INPUT_UNSUPPORTED';
        throw error;
      }

      let response: any;

      if (capabilities.supportsImageEditing) {
        const ext = input.mimeType.split('/')[1] || 'png';
        const filename = `selfie.${ext}`;
        const fileLike = await toFile(input.uploadBuffer, filename, { type: input.mimeType });

        console.log('[GENERATION FILELIKE]', {
          orderId: input.orderId,
          fileName: filename,
          fileType: input.mimeType,
          fileSize: input.uploadBuffer.length
        });
        
        const requestPayload = {
          model: model,
          image: fileLike,
          prompt: prompt,
          n: 1,
          size: (process.env.OPENAI_IMAGE_SIZE || '1024x1024') as any,
          quality: (process.env.OPENAI_IMAGE_QUALITY || 'standard') as any,
          output_format: 'png' as const,
          ...(capabilities.supportsInputFidelity ? { input_fidelity: 'high' as const } : {})
        };

        response = await openai.images.edit(requestPayload);
      } else {
        const error = new Error(`Model ${model} image input strategy not implemented.`);
        (error as any).code = 'GENERATION_INPUT_MISSING';
        throw error;
      }

      const hasImage = !!(response.data?.[0]?.b64_json || response.data?.[0]?.url);

      console.log('[GENERATION OPENAI RESULT]', {
        orderId: input.orderId,
        generationId: input.generationId,
        success: true,
        hasImage,
        providerRequestId: response.created,
        scenarioKey: input.scenario,
        promptUsed: prompt.substring(0, 50) + '...'
      });

      let buffer: Buffer;
      if (response.data?.[0]?.b64_json) {
        buffer = Buffer.from(response.data[0].b64_json, 'base64');
      } else if (response.data?.[0]?.url) {
        const imgRes = await fetch(response.data[0].url);
        if (!imgRes.ok) throw new Error('Falha ao baixar imagem da URL da OpenAI');
        buffer = Buffer.from(await imgRes.arrayBuffer());
      } else {
        throw new Error('No image data returned from provider');
      }
      
      if (!buffer || buffer.length === 0) {
        throw new Error('Generated image buffer is empty (0 bytes)');
      }
      
      const storageResult = await StorageProvider.saveUpload(buffer, 'image/png');
      const internalUrl = storageResult.storageProvider === 'local' 
        ? `local://${storageResult.storageKey}` 
        : (storageResult.blobUrl || '');

      return {
        imageUrl: internalUrl,
        costUsd: 0.08,
        status: 'COMPLETED'
      };

    } catch (error: any) {
      console.error('OpenAI Generation Error:', error);
      
      if (error?.error?.code === 'content_policy_violation' || error?.code === 'content_policy_violation') {
        const customError = new Error('Provider rejected generation (Content Policy).');
        (customError as any).code = 'GENERATION_PROVIDER_REJECTED';
        throw customError;
      }

      if (error?.code === 'GENERATION_INPUT_MISSING') {
        throw error;
      }

      const customError = new Error(error?.message || 'Falha na comunicação com o provider');
      (customError as any).code = 'IMAGE_PROVIDER_ERROR';
      throw customError;
    }
  }
}
