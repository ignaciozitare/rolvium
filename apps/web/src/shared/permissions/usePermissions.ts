import { useMemo } from 'react';
import type { AdminPermissionKey, ModuleId } from '@rolvium/shared-types';
import { useAuth } from '@/shared/hooks/useAuth';
import { hasAnyAdminPermission, hasModule, hasPermission, isAdmin } from './permissions';

export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() => ({
    isAdmin: isAdmin(user),
    can: (perm: AdminPermissionKey) => hasPermission(user, perm),
    canSee: (moduleId: ModuleId) => hasModule(user, moduleId),
    canOpenAdmin: hasAnyAdminPermission(user),
  }), [user]);
}
