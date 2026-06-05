# Dojah Verification — Products, Tiers & Pricing

This document describes what Naija Rent Verify checks through **Dojah** for each verification tier, and what each check costs. It is written for non-technical readers (operations, sales, support, and partners).

---

## What is Dojah?

Dojah is our third-party identity and risk partner. When a landlord requests a tenant verification, we send relevant tenant details to Dojah and use the results to build the verification report and trust score.

---

## Dojah pricing (per check)

These are the costs on our Dojah account for each service (Nigerian Naira, ₦). Each price is for one successful API call.

| Dojah service | What we use it for | Cost |
|---------------|-------------------|------|
| **NIN** | National ID lookup | ₦80 |
| **Phone Screening** | Phone fraud screening | ₦50 |
| **Watch List** | AML / PEP / sanctions screening | ₦100 |
| **Analysis** | ID document analysis | ₦100 |
| **Utility Bill Analysis** | Utility bill review | ₦100 |
| **Credit bureau** | Credit summary (premium only) | Confirm on Dojah dashboard |

*Source: Dojah transaction log, May 2026. Prices may change — confirm on your Dojah dashboard before budgeting.*

---

## Standard Verification

Standard verification is our core tenant screening package. It is suitable for most rental decisions.

**What we check:**

| Check | What it tells you | Cost |
|-------|-------------------|------|
| **National ID (NIN) lookup** | Confirms the tenant’s NIN is valid and returns official identity details (name, date of birth, etc.). We compare this with what the tenant submitted. | ₦80 |
| **Phone fraud screening** | Checks the tenant’s phone number for fraud and risk signals (e.g. whether the number looks legitimate and trustworthy). | ₦50 |
| **Anti–money laundering (AML) screening** | Screens the tenant against watchlists for politically exposed persons (PEP), sanctions, and adverse media. | ₦100 |
| **ID document review** | If the tenant uploads an ID (e.g. driver’s licence or national ID card), Dojah analyses the document and we cross-check it against the NIN record where possible. | ₦100 |
| **Utility bill review** | If the tenant uploads a utility bill, Dojah analyses it to help confirm address and document authenticity. | ₦100 |

**What standard does not include:** credit bureau reports and credit scores.

**Estimated Dojah cost per standard verification:**

| Scenario | Checks run | Total |
|----------|------------|-------|
| Minimum (required checks only) | NIN + phone + AML watch list | **₦230** |
| Full (tenant uploaded ID + utility bill) | All five checks above | **₦430** |

Document checks only run when the tenant uploads those files.

---

## Premium Verification

Premium verification includes **everything in Standard**, plus financial credit checks.

**Additional check (premium only):**

| Check | What it tells you | Cost |
|-------|-------------------|------|
| **Credit bureau report (credit summary)** | Pulls the tenant’s credit history from the bureau using their BVN. Helps assess repayment behaviour and existing credit obligations. | Confirm on Dojah dashboard |

**Important:** Premium verification requires the tenant’s **BVN** (Bank Verification Number). Without a BVN, the credit check cannot run.

**Estimated Dojah cost per premium verification:**

| Scenario | Checks run | Total |
|----------|------------|-------|
| Minimum | Standard minimum + credit bureau | **₦230+** |
| Full | Standard full + credit bureau | **₦430+** |

The “+” is the credit bureau fee — add it once you have the price from your Dojah dashboard.

---

## Side-by-side comparison

| Feature | Standard | Premium | Cost (if run) |
|---------|:--------:|:-------:|---------------|
| NIN identity lookup | Yes | Yes | ₦80 |
| Phone fraud screening | Yes | Yes | ₦50 |
| AML / PEP / sanctions screening | Yes | Yes | ₦100 |
| ID document analysis | Yes (if uploaded) | Yes (if uploaded) | ₦100 |
| Utility bill analysis | Yes (if uploaded) | Yes (if uploaded) | ₦100 |
| Credit bureau report | No | Yes (requires BVN) | TBC |

---

## Optional checks (not part of the usual automated flow)

These can be used in special screening flows when photos are provided. They are **not** always run automatically for every tenant:

| Check | Purpose |
|-------|---------|
| **Selfie matched to NIN** | Confirms the person’s face matches the photo on their NIN record. |
| **Liveness check** | Confirms the selfie is from a live person, not a photo or video replay. |

---

## What landlords see in the report

- **Standard:** Identity, contact, employment, guarantor, and compliance sections in the risk breakdown — focused on who the tenant is and whether they pass identity and compliance checks. Rental history and detailed financial/credit sections are not weighted the same way as premium.
- **Premium:** Same as standard, plus **financial (credit)** and **rental reliability** style insights where credit data is available — giving a fuller picture for high-trust screening.

---

## Environment note (for internal use)

- In **testing/sandbox**, Dojah may use test identity numbers so checks can be tried without real tenant data.
- In **production**, real NIN, phone, and BVN values are used.

---

## Quick reference for Dojah account setup

When enabling products on your Dojah dashboard, align them with our tiers:

**Enable for Standard:**

1. NIN Lookup (Advanced) — ₦80 per call  
2. Phone fraud screening — ₦50 per call  
3. AML screening (v2 — PEP, sanctions, adverse media) — ₦100 per call  
4. Document analysis (ID) — ₦100 per call  
5. Utility bill analysis — ₦100 per call  

**Additionally enable for Premium:**

6. Credit bureau / credit summary — price on dashboard  

---

*Last updated: May 2026 — based on NRV backend verification configuration and Dojah transaction log.*
