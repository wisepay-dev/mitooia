export interface CreatePixResponse {
  id: string;
  qrCode: string;
  qrCodeBase64: string;
  status: string;
}

export class YuvexPayProvider {
  private static readonly API_URL = 'https://api.yuvexpay.com/v1'; // Base from docs

  static async createPixPayment(
    orderId: string, 
    amount: number, // 4.90
    customerName: string = 'Cliente'
  ): Promise<CreatePixResponse> {
    const apiKey = process.env.YUVEX_API_KEY;
    if (!apiKey) {
      throw new Error('YUVEX_API_KEY não configurada');
    }

    const idempotencyKey = `mito-order-${orderId}`;
    
    const buildPayload = (fallbackEmail?: string) => {
      const payload: any = {
        amount: amount,
        methods: ['PIX'],
        currency: 'BRL',
        mode: 'headless',
        description: 'MITO.IA - Geração de Foto',
        externalId: orderId,
        expiresInMinutes: 30, // 30 minutes to pay
        customer: {
          name: customerName
        }
      };
      
      if (fallbackEmail) {
        payload.customer.email = fallbackEmail;
      }
      
      return payload;
    };

    const makeRequest = async (payload: any) => {
      return fetch(`${this.API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });
    };

    let response = await makeRequest(buildPayload());

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = null;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {}

      // Fallback: Se a YuvexPay rejeitar por falta de e-mail (erro 400), tenta novamente com um e-mail único e técnico.
      if (response.status === 400 && errorData && errorText.toLowerCase().includes('email')) {
        console.warn('YuvexPay rejeitou pagamento sem email. Tentando fallback técnico...', errorData);
        response = await makeRequest(buildPayload(`order-${orderId}@mitooia.com.br`));
        
        if (!response.ok) {
          console.error('YuvexPay API Error (Fallback):', await response.text());
          throw new Error('Falha ao criar PIX na YuvexPay (Fallback)');
        }
      } else {
        console.error('YuvexPay API Error:', errorText);
        throw new Error('Falha ao criar PIX na YuvexPay');
      }
    }

    const data = await response.json();
    
    // According to YuvexPay headless specs: methodData contains the PIX info
    const pixCopyPaste = data.methodData?.pixCopyPaste;
    const qrCodeBase64 = data.methodData?.qrCodeBase64;
    
    if (!pixCopyPaste) {
      throw new Error('Resposta YuvexPay não contém pixCopyPaste');
    }

    return {
      id: data.id,
      qrCode: pixCopyPaste,
      qrCodeBase64: qrCodeBase64 || '', // Some gateways return the raw base64 or prefixed with data:image/png;base64,
      status: data.status || 'NEW'
    };
  }
}
