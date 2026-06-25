import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import MercadoPagoConfig, { Payment as MPPayment } from 'mercadopago';

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);
  private readonly mp: MPPayment;

  constructor() {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      this.logger.warn('MERCADOPAGO_ACCESS_TOKEN not set — card payments will fail');
    }
    const client = new MercadoPagoConfig({
      accessToken: accessToken ?? 'NOT_SET',
      options: { timeout: 10000 },
    });
    this.mp = new MPPayment(client);
  }

  async createPayment(params: {
    cardToken: string;
    amount: number;
    description: string;
    installments: number;
    paymentMethodId: string;
    issuerId?: string;
    payerEmail: string;
    externalReference: string;
    notificationUrl?: string;
  }) {
    try {
      return await this.mp.create({
        body: {
          token: params.cardToken,
          transaction_amount: params.amount,
          description: params.description,
          installments: params.installments,
          payment_method_id: params.paymentMethodId,
          issuer_id: params.issuerId ? Number(params.issuerId) : undefined,
          payer: { email: params.payerEmail },
          external_reference: params.externalReference,
          notification_url: params.notificationUrl,
        },
      });
    } catch (err: any) {
      this.logger.error('MercadoPago createPayment error', err?.message);
      throw new InternalServerErrorException(
        err?.cause?.message ?? 'Error procesando el pago con tarjeta',
      );
    }
  }

  async getPayment(mpPaymentId: string) {
    try {
      return await this.mp.get({ id: mpPaymentId });
    } catch (err: any) {
      this.logger.error(`MercadoPago getPayment(${mpPaymentId}) error`, err?.message);
      return null;
    }
  }
}
