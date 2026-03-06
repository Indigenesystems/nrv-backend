import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type VerificationTier = 'standard' | 'premium';

/**
 * Dojah-backed verification tiers for tenant screening.
 *
 * Standard (recommended for platform launch):
 * - NIN Lookup Advanced
 * - Selfie + NIN
 * - Liveness Check
 * - AML Screening
 * - Fraud risk screening
 * - Politically exposed persons & sanctions list
 *
 * Premium (high-trust tier):
 * - All Standard features
 * - Credit Score
 */
@Injectable()
export class DojahTierService {
  private get baseUrl(): string {
    return process.env.DOJAH_SANDBOX === 'false'
      ? 'https://api.dojah.io'
      : 'https://sandbox.dojah.io';
  }

  private get headers(): { AppId: string; Authorization: string } {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    return { AppId: appId, Authorization: authKey };
  }

  constructor(private readonly httpService: HttpService) {}

  /** NIN Lookup Advanced (used in both tiers). */
  async ninLookupAdvanced(nin: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`;
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, { headers: this.headers }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah NIN lookup failed',
      );
    }
  }

  /** Selfie + NIN (face match against NIN record). */
  async selfieAndNin(nin: string, selfieImageBase64: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/kyc/nin/face_match`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          url,
          { nin, selfie_image: selfieImageBase64 },
          { headers: { ...this.headers, 'Content-Type': 'application/json' } },
        ),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah Selfie + NIN verification failed',
      );
    }
  }

  /** Liveness check (prevents spoofing). */
  async livenessCheck(livenessImageBase64: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/ml/liveness/`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          url,
          { image: livenessImageBase64 },
          { headers: { ...this.headers, 'Content-Type': 'application/json' } },
        ),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah liveness check failed',
      );
    }
  }

  /** Generic document analysis (ID and other documents). */
  async documentAnalysis(params: {
    input_type: string;
    imagefrontside: string;
    imagebackside?: string;
    images?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/document/analysis`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, params, {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah document analysis failed',
      );
    }
  }

  /** Utility bill analysis. */
  async utilityBillAnalysis(params: {
    input_type: string;
    input_value: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/document/analysis/utility_bill`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, params, {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah utility bill analysis failed',
      );
    }
  }

  /** Business document analysis. */
  async businessDocumentAnalysis(params: {
    input_type: string;
    input_value: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/document/analysis/business_document`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, params, {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah business document analysis failed',
      );
    }
  }

  /** AML Screening (individual) – legacy v1. Prefer amlScreeningV2Individual. */
  async amlScreening(params: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth: string;
    match_score?: number;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/aml/screening`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, params, {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah AML screening failed',
      );
    }
  }

  /**
   * AML Screening (v2) for individuals – PEP, sanctions, adverse media.
   * POST api/v1/aml/v2/screening with schema "individual".
   */
  async amlScreeningV2Individual(params: {
    names: string;
    gender?: string;
    date_of_birth?: string;
    nationality?: string;
    id_number?: string;
    pep_check?: boolean;
    sanction?: boolean;
    adverse_media_check?: boolean;
    watchlists?: string[];
    match_threshold?: number;
    unique_reference?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/aml/v2/screening`;
    const body = {
      schema: 'individual',
      unique_reference: params.unique_reference,
      properties: {
        names: params.names,
        gender: params.gender || undefined,
        date_of_birth: params.date_of_birth || undefined,
        nationality: params.nationality || undefined,
        id_number: params.id_number || undefined,
      },
      screening_options: {
        pep_check: params.pep_check ?? true,
        sanction: params.sanction ?? true,
        adverse_media_check: params.adverse_media_check ?? true,
        watchlists: params.watchlists ?? [],
        match_threshold: params.match_threshold ?? 0.85,
      },
    };
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah AML v2 screening failed',
      );
    }
  }

  /** PEP & sanctions list (fraud risk). Often included in AML or separate endpoint. */
  async pepAndSanctions(params: {
    first_name: string;
    last_name: string;
    date_of_birth?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/aml/pep_sanctions`;
    try {
      const res = await firstValueFrom(
        this.httpService.post(url, params, {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah PEP/sanctions check failed',
      );
    }
  }

  /** Credit Score (Premium tier only). */
  async creditScore(bvn: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/financial/credit_score?bvn=${encodeURIComponent(bvn)}`;
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, { headers: this.headers }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah credit score check failed',
      );
    }
  }

  /** Credit Summary / Credit Bureau report (Premium tier). */
  async creditSummary(bvn: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/credit_bureau?bvn=${encodeURIComponent(bvn)}`;
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, { headers: this.headers }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah credit summary check failed',
      );
    }
  }

  /** Phone Number Screening for Fraud (risk signals, carrier, status). */
  async phoneFraudScreen(phone: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/fraud/phone?phone=${encodeURIComponent(phone)}`;
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, { headers: this.headers }),
      );
      return res.data;
    } catch (error: any) {
      throw new BadRequestException(
        error?.response?.data || 'Dojah phone fraud screening failed',
      );
    }
  }

  /**
   * Run Standard tier checks: NIN Advanced, Selfie+NIN, Liveness, AML v2 (PEP, sanctions, adverse media).
   * Caller can pass optional selfie/liveness images; if not provided, only NIN + AML v2 run.
   */
  async runStandardScreening(params: {
    nin: string;
    selfieImageBase64?: string;
    livenessImageBase64?: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
  }): Promise<{
    nin: any;
    selfieNin?: any;
    liveness?: any;
    aml: any;
    pepSanctions: any;
  }> {
    const ninResult = await this.ninLookupAdvanced(params.nin);
    const names = [params.firstName, params.middleName, params.lastName].filter(Boolean).join(' ');
    const amlV2Result = await this.amlScreeningV2Individual({
      names,
      date_of_birth: params.dateOfBirth,
      pep_check: true,
      sanction: true,
      adverse_media_check: true,
      match_threshold: 0.85,
    });

    let selfieNin: any;
    let liveness: any;
    if (params.selfieImageBase64) {
      selfieNin = await this.selfieAndNin(params.nin, params.selfieImageBase64);
    }
    if (params.livenessImageBase64) {
      liveness = await this.livenessCheck(params.livenessImageBase64);
    }

    return {
      nin: ninResult,
      selfieNin,
      liveness,
      aml: amlV2Result,
      pepSanctions: amlV2Result,
    };
  }

  /**
   * Run Premium tier: Standard + Credit Score (requires BVN).
   */
  async runPremiumScreening(
    standardParams: Parameters<DojahTierService['runStandardScreening']>[0] & {
      bvn?: string;
    },
  ): Promise<{
    nin: any;
    selfieNin?: any;
    liveness?: any;
    aml: any;
    pepSanctions: any;
    creditScore?: any;
    creditSummary?: any;
  }> {
    const { bvn, ...rest } = standardParams;
    const standard = await this.runStandardScreening(rest);
    let creditScore: any;
    let creditSummary: any;
    if (bvn) {
      try {
        creditScore = await this.creditScore(bvn);
      } catch {
        creditScore = { error: 'Credit score unavailable' };
      }
      try {
        creditSummary = await this.creditSummary(bvn);
      } catch {
        creditSummary = { error: 'Credit summary unavailable' };
      }
    }
    return { ...standard, creditScore, creditSummary };
  }
}
