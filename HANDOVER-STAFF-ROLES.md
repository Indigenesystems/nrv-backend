# Handover: Admin, Roles & Staff (Backend)

**Document version:** 1.0  
**Scope:** nrv-backend only (Staff module, Roles, Person/Staff CRUD, onboarding).  
**Out of scope:** admin-frontend UI and any other frontend apps.

---

## 1. Overview

The backend supports **roles** and **staff (person)** with create, list, update, delete, and **onboarding**. Staff are admin users with a role; they can be created without a password and onboarded later (set password + mark onboarded), or created with a password for immediate onboarding.

---

## 2. Module Location & Registration

| Item | Path |
|------|------|
| Module | `src/staff/staff.module.ts` |
| Controller | `src/staff/staff.controller.ts` |
| Service | `src/staff/staff.service.ts` |
| Entities | `src/staff/entities/role.entity.ts`, `src/staff/entities/staff.entity.ts` |
| DTOs | `src/staff/dto/create-role.dto.ts`, `src/staff/dto/create-staff.dto.ts`, `src/staff/dto/update-staff.dto.ts`, `src/staff/dto/onboard-staff.dto.ts` |

**Registration:** `StaffModule` is imported in `src/app.module.ts`.

**Base path for all endpoints:** `/staff` (e.g. `POST /staff`, `GET /staff/roles`).

---

## 3. Data Models

### 3.1 Role

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | Yes | Unique |
| `slug` | string | Yes | Unique |
| `description` | string | No | Default `''` |
| `permissions` | string[] | No | Default `[]` |
| `createdAt` / `updatedAt` | Date | — | Set by Mongoose `timestamps: true` |

### 3.2 Staff (Person)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `firstName` | string | Yes | |
| `lastName` | string | Yes | |
| `email` | string | Yes | Unique |
| `phone` | string | No | |
| `roleId` | ObjectId (ref: Role) | Yes | |
| `onboardingStatus` | enum | Yes | See below |
| `password` | string | No | Hashed (bcrypt) when set |
| `status` | string | No | Default `'active'` |
| `invitedBy` | ObjectId (ref: Staff) | No | |
| `invitedAt` | Date | No | |
| `onboardedAt` | Date | No | Set when onboarding completes |
| `lastLoginAt` | Date | No | |
| `createdAt` / `updatedAt` | Date | — | Set by Mongoose `timestamps: true` |

**OnboardingStatus enum:** `pending` | `invited` | `onboarded` | `deactivated`.

---

## 4. API Reference

All responses use a consistent shape where applicable:

- Success: `{ status: 'success', message: string, data?: T }`
- List with pagination: `data` array plus `pagination: { total, page, limit, totalPages }`

Base URL is the backend root (e.g. `http://localhost:9000`). No auth is applied in the current implementation; add guards/middleware as required.

### 4.1 Roles

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/staff/roles` | Create a role |
| `GET` | `/staff/roles` | List all roles (no pagination) |
| `GET` | `/staff/roles/:id` | Get one role by ID |

**Create role – request body (POST /staff/roles):**

```json
{
  "name": "Admin",
  "slug": "admin",
  "description": "Optional description",
  "permissions": ["optional", "array"]
}
```

- `name`, `slug`: required; must be unique.

**List roles – response:**

```json
{
  "status": "success",
  "message": "Roles fetched",
  "data": [
    {
      "_id": "...",
      "name": "Admin",
      "slug": "admin",
      "description": "...",
      "permissions": []
    }
  ]
}
```

### 4.2 Staff (Person)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/staff` | Create staff |
| `GET` | `/staff` | List staff (paginated, filterable) |
| `GET` | `/staff/:id` | Get one staff by ID (role populated) |
| `PATCH` | `/staff/:id` | Update staff |
| `POST` | `/staff/:id/onboard` | Onboard staff (set password, mark onboarded) |
| `DELETE` | `/staff/:id` | Delete staff |

**Create staff – request body (POST /staff):**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "roleId": "<role _id>",
  "password": "optional-min-6-chars",
  "onboardingStatus": "pending"
}
```

- `firstName`, `lastName`, `email`, `roleId`: required.
- If `password` is provided and valid (min 6 chars), the staff is created as **onboarded** and `onboardedAt` is set; otherwise `onboardingStatus` remains `pending` (or as sent).
- Optional query: `invitedBy=<staffId>` to set `invitedBy` and `invitedAt`.

**List staff – query params (GET /staff):**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Page size (default 10, max 100) |
| `search` | string | Search in firstName, lastName, email (case-insensitive) |
| `roleId` | string | Filter by role ID |
| `onboardingStatus` | string | Filter by status |
| `sortBy` | string | Field to sort by |
| `sortOrder` | `asc` \| `desc` | Sort direction |

**List staff – response:**

```json
{
  "status": "success",
  "message": "Staff list fetched",
  "data": [
    {
      "_id": "...",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "phone": "...",
      "roleId": { "_id": "...", "name": "Admin", "slug": "admin" },
      "onboardingStatus": "onboarded",
      "status": "active",
      "invitedBy": null,
      "invitedAt": null,
      "onboardedAt": "2025-...",
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Get staff by ID – response:** Single staff object; `roleId` is populated (role document with `name`, `slug`, and optionally `description`).

**Update staff – request body (PATCH /staff/:id):** Same fields as create; all optional. If `password` is sent, it is hashed before save. Email must remain unique if changed.

**Onboard staff – request body (POST /staff/:id/onboard):**

```json
{
  "password": "min-6-characters"
}
```

- Sets hashed password, `onboardingStatus` to `onboarded`, `onboardedAt` to now, and `status` to `active`.
- Returns 400 if staff is already onboarded.

**Delete staff – response:** No body; 200 on success. Returns 404 if ID not found.

---

## 5. Default Data (Seed)

On application startup, `StaffService.onModuleInit()` runs:

- If the **Role** collection is empty, it inserts three default roles:
  - **Admin** (slug: `admin`) – “Full admin access”
  - **Staff** (slug: `staff`) – “Staff member”
  - **Viewer** (slug: `viewer`) – “Read-only access”

No default staff are created. Any client (e.g. another admin UI) can list these roles and use them when creating staff.

---

## 6. Behaviour Summary

- **Roles:** Create and list only (no update/delete in this handover).
- **Staff:** Full CRUD; list supports pagination, search, and filters.
- **Onboarding:** Either set `password` on create (immediate onboard) or call `POST /staff/:id/onboard` later.
- **Passwords:** Stored hashed (bcrypt, salt rounds 10). Never returned in API responses.
- **Validation:** DTOs use `class-validator`; controller uses `ValidationPipe` with `whitelist: true`.

---

## 7. Integration Notes for Clients

- Use **GET /staff/roles** to populate role dropdowns when creating/editing staff.
- Use **GET /staff** with `page`, `limit`, `search`, `roleId`, `onboardingStatus` for list UIs.
- Use **GET /staff/:id** for detail views (role is already populated).
- For “invite” flows, create staff without password and optionally pass `invitedBy`; later call **POST /staff/:id/onboard** when they set their password.

This handover does not describe any admin-frontend or other UI; it is limited to the nrv-backend Staff/Roles implementation as above.
