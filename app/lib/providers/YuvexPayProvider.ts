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
    email: string,
    customerName: string = 'Cliente'
  ): Promise<CreatePixResponse> {
    const apiKey = process.env.YUVEX_API_KEY;
    if (!apiKey) {
      throw new Error('YUVEX_API_KEY não configurada');
    }

    const idempotencyKey = `mito-order-${orderId}`;
    
    const payload = {
      amount: amount,
      methods: ['PIX'],
      currency: 'BRL',
      mode: 'headless',
      description: 'MITO.IA - Geração de Foto',
      externalId: orderId,
      expiresInMinutes: 30, // 30 minutes to pay
      customer: {
        name: customerName,
        email: email
      }
    };

    const response = await fetch(`${this.API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('YuvexPay API Error:', errorData);
      throw new Error('Falha ao criar PIX na YuvexPay');
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
