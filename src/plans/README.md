# Plans & Verification Tiers (Dojah)

## Overview

- **Standard Verification** – Recommended for platform launch. Includes: NIN Lookup Advanced, Selfie + NIN, Liveness Check, AML Screening, Fraud risk screening, PEP & sanctions list.
- **Premium Tenant Screening** – High-trust tier. All Standard features plus **Credit Score**.

All users are assigned **Premium** by default (best starting level). Plans define verification credits (standard/premium) per pack; there is no property limit.

| Plan     | Verification tier |
|----------|--------------------|
| standard | Standard           |
| premium  | Premium            |

## API

- `GET /plans` – List all plans.
- `GET /plans/default` – Get default plan (Premium).
- `GET /plans/:slug` – Get plan by slug (`standard` or `premium`).

## Dojah screening (verification tiers)

- `POST /verification/screening/standard` – Run Standard tier (NIN, optional selfie/liveness, AML, PEP/sanctions).
- `POST /verification/screening/premium` – Run Premium tier (Standard + optional BVN credit score).

Required body for both: `nin`, `firstName`, `lastName`, `dateOfBirth`. Optional: `middleName`, `selfieImageBase64`, `livenessImageBase64`. For Premium, optional: `bvn`.

## Environment

Set in `.env` for Dojah:

- `DOJAH_APP_ID` – Dojah app id.
- `DOJAH_AUTH_KEY` – Dojah authorization key.
- `DOJAH_SANDBOX` – Set to `true` (or omit) for sandbox; `false` for production.

Dojah API paths in `dojah-tier.service.ts` may need to be adjusted to match the current Dojah API (e.g. face match, liveness, AML, credit score endpoints).
