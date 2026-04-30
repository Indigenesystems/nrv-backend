import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  logDojahRequest,
  logDojahResponse,
  maskDigits,
  summarizeError,
  summarizeForLog,
} from './dojah-logging';

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

  /** Wrap Dojah HTTP: logs request, latency, success body summary or error. */
  private async traceDojah<T>(
    operation: string,
    meta: Record<string, unknown>,
    fn: () => Promise<T>,
    mapError: (err: unknown) => never,
  ): Promise<T> {
    const t0 = Date.now();
    logDojahRequest(operation, { ...meta, baseUrl: this.baseUrl });
    try {
      const out = await fn();
      logDojahResponse(operation, Date.now() - t0, true, summarizeForLog(out, 900));
      return out;
    } catch (err) {
      logDojahResponse(operation, Date.now() - t0, false, summarizeError(err));
      return mapError(err);
    }
  }

  /** NIN Lookup Advanced (used in both tiers). */
  async ninLookupAdvanced(nin: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`;
    return this.traceDojah(
      'ninLookupAdvanced',
      { nin: maskDigits(nin) },
      async () =>
        (
          await firstValueFrom(
            this.httpService.get(url, { headers: this.headers }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah NIN lookup failed',
        );
      },
    );
  }

  /** Selfie + NIN (face match against NIN record). */
  async selfieAndNin(nin: string, selfieImageBase64: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/kyc/nin/face_match`;
    return this.traceDojah(
      'selfieAndNin',
      {
        nin: maskDigits(nin),
        selfieBase64Length: selfieImageBase64?.length ?? 0,
      },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(
              url,
              { nin, selfie_image: selfieImageBase64 },
              { headers: { ...this.headers, 'Content-Type': 'application/json' } },
            ),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah Selfie + NIN verification failed',
        );
      },
    );
  }

  /** Liveness check (prevents spoofing). */
  async livenessCheck(livenessImageBase64: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/ml/liveness/`;
    return this.traceDojah(
      'livenessCheck',
      { imageBase64Length: livenessImageBase64?.length ?? 0 },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(
              url,
              { image: livenessImageBase64 },
              { headers: { ...this.headers, 'Content-Type': 'application/json' } },
            ),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah liveness check failed',
        );
      },
    );
  }

  /** Generic document analysis (ID and other documents). */
  async documentAnalysis(params: {
    input_type: string;
    imagefrontside: string;
    imagebackside?: string;
    images?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/document/analysis`;
    return this.traceDojah(
      'documentAnalysis',
      {
        input_type: params.input_type,
        imagefrontsideLength: params.imagefrontside?.length ?? 0,
        imagebacksideLength: params.imagebackside?.length ?? 0,
        imagesLength: params.images?.length ?? 0,
      },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(url, params, {
              headers: { ...this.headers, 'Content-Type': 'application/json' },
            }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah document analysis failed',
        );
      },
    );
  }

  /** Utility bill analysis. */
  async utilityBillAnalysis(params: {
    input_type: string;
    input_value: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/document/analysis/utility_bill`;
    let inputHost = 'n/a';
    try {
      inputHost = new URL(params.input_value).host;
    } catch {
      inputHost = 'non-url';
    }
    return this.traceDojah(
      'utilityBillAnalysis',
      { input_type: params.input_type, input_valueHost: inputHost },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(url, params, {
              headers: { ...this.headers, 'Content-Type': 'application/json' },
            }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah utility bill analysis failed',
        );
      },
    );
  }

  /** Business document analysis. */
  async businessDocumentAnalysis(params: {
    input_type: string;
    input_value: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/document/analysis/business_document`;
    return this.traceDojah(
      'businessDocumentAnalysis',
      { input_type: params.input_type, input_valueLength: params.input_value?.length ?? 0 },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(url, params, {
              headers: { ...this.headers, 'Content-Type': 'application/json' },
            }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah business document analysis failed',
        );
      },
    );
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
    return this.traceDojah(
      'amlScreening_v1',
      {
        first_name: maskDigits(params.first_name, 2),
        last_name: maskDigits(params.last_name, 2),
        date_of_birth: params.date_of_birth,
      },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(url, params, {
              headers: { ...this.headers, 'Content-Type': 'application/json' },
            }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah AML screening failed',
        );
      },
    );
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
    return this.traceDojah(
      'amlScreeningV2Individual',
      {
        namesLength: (params.names || '').length,
        hasDob: !!params.date_of_birth,
        id_number: params.id_number ? maskDigits(String(params.id_number), 4) : undefined,
      },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(url, body, {
              headers: { ...this.headers, 'Content-Type': 'application/json' },
            }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah AML v2 screening failed',
        );
      },
    );
  }

  /** PEP & sanctions list (fraud risk). Often included in AML or separate endpoint. */
  async pepAndSanctions(params: {
    first_name: string;
    last_name: string;
    date_of_birth?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/v1/aml/pep_sanctions`;
    return this.traceDojah(
      'pepAndSanctions',
      {
        first_name: maskDigits(params.first_name, 2),
        last_name: maskDigits(params.last_name, 2),
        hasDob: !!params.date_of_birth,
      },
      async () =>
        (
          await firstValueFrom(
            this.httpService.post(url, params, {
              headers: { ...this.headers, 'Content-Type': 'application/json' },
            }),
          )
        ).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah PEP/sanctions check failed',
        );
      },
    );
  }

  /** Credit Score (Premium tier only). */
  async creditScore(bvn: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/financial/credit_score?bvn=${encodeURIComponent(bvn)}`;
    return this.traceDojah(
      'creditScore',
      { bvn: maskDigits(bvn) },
      async () =>
        (await firstValueFrom(this.httpService.get(url, { headers: this.headers }))).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah credit score check failed',
        );
      },
    );
  }

  /** Credit Summary / Credit Bureau report (Premium tier). */
  async creditSummary(bvn: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/credit_bureau?bvn=${encodeURIComponent(bvn)}`;
    return this.traceDojah(
      'creditSummary',
      { bvn: maskDigits(bvn) },
      async () =>
        (await firstValueFrom(this.httpService.get(url, { headers: this.headers }))).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah credit summary check failed',
        );
      },
    );
  }

  /** Phone Number Screening for Fraud (risk signals, carrier, status). */
  async phoneFraudScreen(phone: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/fraud/phone?phone=${encodeURIComponent(phone)}`;
    return this.traceDojah(
      'phoneFraudScreen',
      { phone: maskDigits(phone.replace(/\D/g, ''), 4) },
      async () =>
        (await firstValueFrom(this.httpService.get(url, { headers: this.headers }))).data,
      (error) => {
        throw new BadRequestException(
          (error as any)?.response?.data || 'Dojah phone fraud screening failed',
        );
      },
    );
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
    const t0 = Date.now();
    logDojahRequest('runStandardScreening', {
      hasSelfie: !!params.selfieImageBase64,
      hasLiveness: !!params.livenessImageBase64,
      nin: maskDigits(params.nin),
    });
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

    const bundle = {
      nin: ninResult,
      selfieNin,
      liveness,
      aml: amlV2Result,
      pepSanctions: amlV2Result,
    };
    logDojahResponse(
      'runStandardScreening',
      Date.now() - t0,
      true,
      `done selfie=${!!selfieNin} liveness=${!!liveness} summary=${summarizeForLog(bundle, 500)}`,
    );
    return bundle;
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
    const t0 = Date.now();
    const { bvn, ...rest } = standardParams;
    logDojahRequest('runPremiumScreening', {
      hasBvn: !!bvn,
      bvn: bvn ? maskDigits(bvn) : undefined,
    });
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
    const out = { ...standard, creditScore, creditSummary };
    logDojahResponse(
      'runPremiumScreening',
      Date.now() - t0,
      true,
      `creditScore=${creditScore && !creditScore.error ? 'ok' : creditScore ? 'fallback' : 'skipped'} creditSummary=${creditSummary && !creditSummary.error ? 'ok' : creditSummary ? 'fallback' : 'skipped'}`,
    );
    return out;
  }
}
