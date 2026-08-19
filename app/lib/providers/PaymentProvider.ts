import { YuvexPayProvider, CreatePixResponse } from './YuvexPayProvider';

export class PaymentProvider {
  /**
   * Creates a PIX payment intention for the given order.
   * Note: orderId must be the internal DB order.id
   * Amount in internal representation is usually cents, but we pass cents to this method 
   * and internally divide by 100 since YuvexPay expects Decimal (4.90).
   */
  static async createPixPayment(orderId: string, amountInCents: number): Promise<CreatePixResponse> {
    const amountInDecimal = amountInCents / 100;
    
    // Delegate to YuvexPay
    return YuvexPayProvider.createPixPayment(orderId, amountInDecimal);
  }
}
