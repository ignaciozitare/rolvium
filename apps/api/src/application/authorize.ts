import { ADMIN_ROLE_NAME, type AdminPermissionKey } from '@rolvium/shared-types';
import type { UserProfile } from '../domain/user/IUserRepository.js';

/** True if the profile may exercise `perm`. Admin bypasses everything. */
export function hasPermission(profile: Pick<UserProfile, 'role' | 'permissions' | 'active'>, perm: AdminPermissionKey): boolean {
  if (!profile.active) return false;
  if (profile.role === ADMIN_ROLE_NAME) return true;
  return profile.permissions.admin[perm] === true;
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
  constructor(perm: AdminPermissionKey) {
    super(`Missing permission: ${perm}`);
  }
}

/** Throws ForbiddenError unless the profile has `perm`. */
export function assertPermission(profile: Pick<UserProfile, 'role' | 'permissions' | 'active'>, perm: AdminPermissionKey): void {
  if (!hasPermission(profile, perm)) throw new ForbiddenError(perm);
}
