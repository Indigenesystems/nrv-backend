import {
  checkNinNameAlignment,
  getNinDobFromEntity,
  normalizePersonName,
  resolveDojahNinEntity,
} from './nin-name-match.util';

/** Landlord / risk outcome for Dojah ID document analysis. */
export type IdDocumentLandlordStatus =
  | 'verified'
  | 'failed'
  | 'not_run'
  | 'not_provided';

export type IdDocumentNinAlignment = {
  /** Dojah document scan passed (overall_status VALID). */
  technicallyValid: boolean;
  /** Name on ID matches NIN record (case-insensitive). */
  namesMatch: boolean;
  /** DOB on ID matches NIN when both are present. */
  dobMatch: boolean;
  /** technicallyValid + namesMatch + DOB rule satisfied. */
  authentic: boolean;
  extractedFullName: string;
  mismatchReason?: string;
};

const normalizeFieldKey = (key: string): string =>
  key.trim().toLowerCase().replace(/\s+/g, '_');

const pushField = (map: Record<string, string>, rawKey: string, value: unknown) => {
  if (value == null) {
    return;
  }
  const str = String(value).trim();
  if (!str) {
    return;
  }
  map[normalizeFieldKey(rawKey)] = str;
};

const resolveDojahIdEntity = (
  analysis: Record<string, unknown>,
): Record<string, unknown> => {
  return (analysis.entity ?? analysis) as Record<string, unknown>;
};

export const resolveDojahIdEntityStatus = (
  analysis: Record<string, unknown>,
): Record<string, unknown> | null => {
  const entity = resolveDojahIdEntity(analysis);
  const status = entity?.status;
  if (!status || typeof status !== 'object') {
    return null;
  }
  return status as Record<string, unknown>;
};

/** Dojah HTTP 200: overall_status 1 / reason VALID. */
export const isDojahIdDocumentTechnicallyValid = (
  analysis: Record<string, unknown> | null | undefined,
): boolean => {
  if (!analysis) {
    return false;
  }
  if (String(analysis.status ?? '').toLowerCase() === 'failed' || analysis.error) {
    return false;
  }
  const entityStatus = resolveDojahIdEntityStatus(analysis);
  if (!entityStatus) {
    return true;
  }
  const overall = entityStatus.overall_status;
  const reason = String(entityStatus.reason ?? '').toUpperCase();
  if (overall === 1 || overall === '1' || reason === 'VALID') {
    return true;
  }
  if (
    overall === 0 ||
    overall === '0' ||
    reason === 'INVALID' ||
    reason === 'NOT_VALID'
  ) {
    return false;
  }
  return false;
};

const readFieldsFromTextData = (
  entity: Record<string, unknown>,
  fields: Record<string, string>,
) => {
  const textData = entity.text_data;
  if (!Array.isArray(textData)) {
    return;
  }
  for (const row of textData) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const key = String(r.field_key ?? r.field_name ?? r.key ?? r.name ?? '');
    pushField(fields, key, r.value);
  }
};

const readFieldsFromExtracted = (
  entity: Record<string, unknown>,
  fields: Record<string, string>,
) => {
  const extracted = entity.extracted_fields ?? entity.extracted_fields_list;
  if (Array.isArray(extracted)) {
    for (const row of extracted) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const r = row as Record<string, unknown>;
      pushField(fields, String(r.key ?? r.name ?? r.field_name ?? ''), r.value);
    }
    return;
  }
  if (extracted && typeof extracted === 'object') {
    for (const [k, v] of Object.entries(extracted as Record<string, unknown>)) {
      pushField(fields, k, v);
    }
  }
};

/** OCR / structured fields from Dojah document analysis entity. */
export const extractIdDocumentIdentity = (
  analysis: Record<string, unknown> | null | undefined,
): {
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string | null;
} => {
  if (!analysis) {
    return { fullName: '', firstName: '', lastName: '', middleName: '', dateOfBirth: null };
  }
  const entity = resolveDojahIdEntity(analysis);
  const fields: Record<string, string> = {};
  readFieldsFromTextData(entity, fields);
  readFieldsFromExtracted(entity, fields);

  const first =
    fields.first_name ??
    fields.given_name ??
    fields.given_names ??
    fields.forename ??
    '';
  const middle = fields.middle_name ?? fields.other_names ?? '';
  const last =
    fields.last_name ??
    fields.surname ??
    fields.family_name ??
    '';
  const fullFromParts = [first, middle, last].filter(Boolean).join(' ');
  const fullName =
    fields.full_name ??
    fields.fullname ??
    fields.name ??
    fields.document_holder_name ??
    fullFromParts;

  const dob =
    fields.date_of_birth ??
    fields.dob ??
    fields.birth_date ??
    fields.birthdate ??
    null;

  return {
    fullName: fullName.trim(),
    firstName: first.trim(),
    lastName: last.trim(),
    middleName: middle.trim(),
    dateOfBirth: dob,
  };
};

const storedIdNinAlignment = (
  analysis: Record<string, unknown> | null | undefined,
): IdDocumentNinAlignment | null => {
  const stored = analysis?.idNinAlignment;
  if (!stored || typeof stored !== 'object') {
    return null;
  }
  const s = stored as IdDocumentNinAlignment;
  if (typeof s.authentic !== 'boolean') {
    return null;
  }
  return s;
};

/**
 * Compare ID document extracted identity to NIN (not applicant profile).
 * Authentic = Dojah VALID + name match; DOB required only when both sides have DOB.
 */
export const getIdDocumentNinAlignment = (
  analysis: Record<string, unknown> | null | undefined,
  ninVerificationResult: unknown,
): IdDocumentNinAlignment => {
  const technicallyValid = isDojahIdDocumentTechnicallyValid(analysis);
  const idIdentity = extractIdDocumentIdentity(analysis);
  const ninEntity = resolveDojahNinEntity(ninVerificationResult);

  const empty: IdDocumentNinAlignment = {
    technicallyValid,
    namesMatch: false,
    dobMatch: false,
    authentic: false,
    extractedFullName: idIdentity.fullName,
  };

  if (!analysis) {
    return { ...empty, mismatchReason: 'no_document_analysis' };
  }
  if (!technicallyValid) {
    return {
      ...empty,
      mismatchReason: 'document_not_valid',
    };
  }
  if (!ninEntity) {
    return {
      ...empty,
      mismatchReason: 'nin_not_available',
    };
  }

  const compareName =
    idIdentity.fullName ||
    [idIdentity.firstName, idIdentity.middleName, idIdentity.lastName]
      .filter(Boolean)
      .join(' ');

  if (!compareName.trim()) {
    return {
      ...empty,
      mismatchReason: 'no_name_on_document',
    };
  }

  const { namesMatch, dobMatch } = checkNinNameAlignment(
    ninEntity,
    compareName,
    idIdentity.dateOfBirth,
  );

  const ninDob = getNinDobFromEntity(ninEntity);
  const dobComparisonRequired =
    !!idIdentity.dateOfBirth?.trim() &&
    ninDob != null &&
    String(ninDob).trim() !== '';

  const authentic =
    technicallyValid &&
    namesMatch &&
    (!dobComparisonRequired || dobMatch);

  let mismatchReason: string | undefined;
  if (!namesMatch) {
    mismatchReason = 'name_mismatch_with_nin';
  } else if (dobComparisonRequired && !dobMatch) {
    mismatchReason = 'dob_mismatch_with_nin';
  }

  return {
    technicallyValid,
    namesMatch,
    dobMatch,
    authentic,
    extractedFullName: compareName.trim(),
    mismatchReason,
  };
};

export const getIdDocumentNinAlignmentForDoc = (doc: {
  identificationDocumentAnalysis?: Record<string, unknown> | null;
  ninVerificationResult?: unknown;
}): IdDocumentNinAlignment => {
  const analysis = doc.identificationDocumentAnalysis;
  const stored = storedIdNinAlignment(analysis);
  if (stored) {
    return stored;
  }
  return getIdDocumentNinAlignment(analysis, doc.ninVerificationResult);
};

/**
 * Landlord ID status: Dojah VALID and extracted name matches NIN.
 */
export const resolveIdDocumentLandlordStatus = (
  identificationDocumentUrl: string | undefined | null,
  analysis: Record<string, unknown> | null | undefined,
  ninVerificationResult?: unknown,
): IdDocumentLandlordStatus => {
  if (!identificationDocumentUrl?.trim()) {
    return 'not_provided';
  }
  if (!analysis) {
    return 'not_run';
  }
  if (String(analysis.status ?? '').toLowerCase() === 'failed' || analysis.error) {
    return 'failed';
  }

  const alignment = getIdDocumentNinAlignment(analysis, ninVerificationResult);
  return alignment.authentic ? 'verified' : 'failed';
};
