export interface CreatePixResponse {
  id: string;
  pixCopyPaste: string;
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
          const fallbackText = await response.text();
          let fallbackData: any = {};
          try { fallbackData = JSON.parse(fallbackText); } catch(e) {}
          
          console.error('[UVEX] payment creation failed', {
            status: response.status,
            error: fallbackData.error || fallbackText,
            code: fallbackData.code
          });
          throw new Error('Falha ao criar PIX na YuvexPay (Fallback)');
        }
      } else {
        console.error('[UVEX] payment creation failed', {
          status: response.status,
          error: errorData?.error || errorText,
          code: errorData?.code
        });
        throw new Error('Falha ao criar PIX na YuvexPay');
      }
    }

    const data = await response.json();
    
    console.info("[YUVEX] response", {
      httpStatus: response.status,
      hasPayment: !!data?.payment,
      paymentId: data?.payment?.id,
      status: data?.payment?.status,
      paymentMethod: data?.payment?.paymentMethod,
      hasMethodData: !!data?.payment?.methodData,
      hasPixCopyPaste: !!data?.payment?.methodData?.pixCopyPaste,
      hasQrCodeBase64: !!data?.payment?.methodData?.qrCodeBase64
    });

    const payment = data.payment;
    
    if (!payment) {
      throw new Error('Resposta YuvexPay não contém objeto payment');
    }

    const pixCopyPaste = payment?.methodData?.pixCopyPaste;
    const qrCodeBase64 = payment?.methodData?.qrCodeBase64;
    
    if (!pixCopyPaste) {
      throw new Error('Resposta YuvexPay não contém pixCopyPaste');
    }

    return {
      id: payment.id,
      pixCopyPaste: pixCopyPaste,
      qrCodeBase64: qrCodeBase64 || '', // Some gateways return the raw base64 or prefixed with data:image/png;base64,
      status: payment.status || 'NEW'
    };
  }
}
