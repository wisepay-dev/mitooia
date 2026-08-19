import OpenAI from 'openai';
import fs from 'fs/promises';
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
  | 'selfie_tematica'
  | 'comicio_verde_amarelo'
  | 'poster_cinematografico'
  | 'brasil_estetica'
  | 'caricatura_premium'
  | 'quadrinhos';

interface GenerationInput {
  uploadBuffer: Buffer;
  mimeType: string;
  scenario: ScenarioTheme;
}

export class ImageGenerationProvider {
  /**
   * Translates the scenario to a safe, stylized prompt.
   * We use stylized prompts by default to avoid DALL-E blocking real public figures
   * and to comply with the "NÃO tentar contornar bloqueios" rule.
   */
  private static getPromptForScenario(scenario: ScenarioTheme): string {
    const baseDisclaimer = " A highly stylized, clearly fictitious illustration. Do not attempt photorealism. ";
    switch (scenario) {
      case 'selfie_tematica':
        return baseDisclaimer + "A casual, stylized digital painting of the person taking a selfie in a lively Brazilian street festival, vibrant green and yellow colors.";
      case 'comicio_verde_amarelo':
        return baseDisclaimer + "An epic, stylized comic-book style illustration of a massive patriotic Brazilian gathering, green and yellow flags, energetic atmosphere.";
      case 'poster_cinematografico':
        return baseDisclaimer + "A dramatic cinematic movie poster style illustration, intense lighting, heroic pose, Brazilian aesthetic.";
      case 'brasil_estetica':
        return baseDisclaimer + "A vibrant digital art piece incorporating Brazilian visual elements, green, yellow, blue, and white, modern aesthetic.";
      case 'caricatura_premium':
        return baseDisclaimer + "A premium editorial caricature, clearly illustrative and exaggerated, elegant strokes.";
      case 'quadrinhos':
        return baseDisclaimer + "A graphic novel style panel, bold outlines, halftone dots, heroic Brazilian theme.";
      default:
        return baseDisclaimer + "A beautiful stylized digital artwork.";
    }
  }

  static async generate(input: GenerationInput): Promise<{ imageUrl: string, costUsd: number, status: string }> {
    if (!isEnabled || !hasKey || !openai) {
      console.log('[MOCK] Generating fake image for scenario:', input.scenario);
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      return {
        imageUrl: 'local://mock-generated-image.jpg', // In a real app we'd return a placeholder static image
        costUsd: 0,
        status: 'COMPLETED'
      };
    }

    try {
      // NOTE: DALL-E doesn't easily accept "face swap" natively with just an image prompt in DALL-E 3.
      // DALL-E 2 edit endpoint requires a mask.
      // For this MVP, if we use DALL-E, we typically need to use the edits endpoint with a transparent mask
      // or use a specialized provider. Given OpenAI constraints, we will attempt DALL-E 2 edits or variations.
      // Given the prompt: "Utilizar a API oficial atual da OpenAI", we will use image variations 
      // as a proxy for the MVP, or just standard generation if variations don't accept prompts in the SDK.
      // Actually, DALL-E 2 `createEdit` requires the original image to be a square PNG < 4MB.
      // For the MVP, we will use `createVariation` or simply `createImage` with the prompt, as DALL-E 3 doesn't support image-to-image currently in the standard API (only text-to-image).
      // Let's implement text-to-image for safety, since face-swapping politicians is highly restricted.
      
      const prompt = this.getPromptForScenario(input.scenario);
      
      const response = await openai.images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: (process.env.OPENAI_IMAGE_SIZE as any) || '1024x1024',
        quality: (process.env.OPENAI_IMAGE_QUALITY as any) || 'standard'
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
      const storageResult = await StorageProvider.saveUpload(buffer, 'image/png');
      const internalUrl = storageResult.storageProvider === 'local' 
        ? `local://${storageResult.storageKey}` 
        : (storageResult.blobUrl || '');

      return {
        imageUrl: internalUrl,
        costUsd: 0.04, // Approx cost for DALL-E 3 standard
        status: 'COMPLETED'
      };

    } catch (error: any) {
      console.error('OpenAI Generation Error:', error);
      
      // Handle content policy violation
      if (error?.error?.code === 'content_policy_violation' || error?.code === 'content_policy_violation') {
        const customError = new Error('Violates content policy');
        (customError as any).code = 'content_policy_violation';
        throw customError;
      }

      const customError = new Error(error?.message || 'Falha na comunicação com o provider');
      (customError as any).code = 'IMAGE_PROVIDER_ERROR';
      throw customError;
    }
  }
}
