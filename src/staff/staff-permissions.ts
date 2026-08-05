/**
 * Central staff RBAC policy (admin-hub / /staff JWT).
 *
 * Role slugs (seeded): admin | staff | viewer
 *
 * Viewer: read-only — no property mutations, no staff/user management.
 * Staff: can manage properties (approve/edit/soft-delete) but cannot create/manage staff.
 * Admin: full access including staff user management.
 */
export type StaffRoleSlug = 'admin' | 'staff' | 'viewer' | string;

export type StaffPermission =
  | 'properties.read'
  | 'properties.write'
  | 'properties.delete'
  | 'staff.read'
  | 'staff.write'
  | 'roles.write'
  | 'verifications.read'
  | 'verifications.write';

const ROLE_PERMISSIONS: Record<string, StaffPermission[]> = {
  viewer: [
    'properties.read',
    'staff.read',
    'verifications.read',
  ],
  staff: [
    'properties.read',
    'properties.write',
    'properties.delete',
    'staff.read',
    'verifications.read',
    'verifications.write',
  ],
  admin: [
    'properties.read',
    'properties.write',
    'properties.delete',
    'staff.read',
    'staff.write',
    'roles.write',
    'verifications.read',
    'verifications.write',
  ],
};

export const normalizeStaffRoleSlug = (slug?: string | null): string =>
  String(slug || '')
    .trim()
    .toLowerCase();

export const staffHasPermission = (
  roleSlug: string | undefined | null,
  permission: StaffPermission,
): boolean => {
  const slug = normalizeStaffRoleSlug(roleSlug);
  const perms = ROLE_PERMISSIONS[slug] || ROLE_PERMISSIONS.viewer;
  return perms.includes(permission);
};

/** Privilege rank — higher can create/assign lower-or-equal roles only. */
export const staffRoleRank = (roleSlug: string | undefined | null): number => {
  const slug = normalizeStaffRoleSlug(roleSlug);
  if (slug === 'admin') {
    return 3;
  }
  if (slug === 'staff') {
    return 2;
  }
  if (slug === 'viewer') {
    return 1;
  }
  return 0;
};

export const canAssignStaffRole = (
  actorRoleSlug: string | undefined | null,
  targetRoleSlug: string | undefined | null,
): boolean => staffRoleRank(actorRoleSlug) >= staffRoleRank(targetRoleSlug);
