import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaystackService {
  private readonly baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
  private readonly secret = process.env.PAYSTACK_SECRET_KEY || '';

  constructor(private readonly http: HttpService) {}

  async initializeTransaction(params: {
    email: string;
    amountNaira: number;
    reference: string;
    callbackUrl: string;
    metadata?: any;
  }) {
    const { email, amountNaira, reference, callbackUrl, metadata } = params;

    const url = `${this.baseUrl}/transaction/initialize`;
    const payload = {
      email,
      amount: Math.round(amountNaira * 100), // Paystack expects kobo
      reference,
      callback_url: callbackUrl,
      metadata,
    };

    try {
      const res = await firstValueFrom(
        this.http.post(url, payload, {
          headers: {
            Authorization: `Bearer sk_test_9abe45e6cedf9a8254b99d4d9c09ddd677c77730`,
            'Content-Type': 'application/json',
          },
        }),
      );

      if (!res.data?.status) {
        throw new HttpException(res.data?.message || 'Paystack init failed', 400);
      }

      return res.data.data as {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    } catch (e: any) {
      throw new HttpException(
        e?.response?.data || e?.message || 'Failed to initialize payment',
        e?.response?.status || 400,
      );
    }
  }

  async verifyTransaction(reference: string) {
    const url = `${this.baseUrl}/transaction/verify/${reference}`;
    try {
      const res = await firstValueFrom(
        this.http.get(url, {
          headers: {
            Authorization: `Bearer ${this.secret}`,
          },
        }),
      );
      return res.data;
    } catch (e: any) {
      throw new HttpException(
        e?.response?.data || e?.message || 'Failed to verify payment',
        e?.response?.status || 400,
      );
    }
  }
}

