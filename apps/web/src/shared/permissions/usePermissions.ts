import { useMemo } from 'react';
import type { AdminPermissionKey, ModuleId, ToolPermissionKey } from '@rolvium/shared-types';
import { useAuth } from '@/shared/hooks/useAuth';
import { hasAnyAdminPermission, hasModule, hasPermission, hasTool, isAdmin } from './permissions';

export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() => ({
    isAdmin: isAdmin(user),
    can: (perm: AdminPermissionKey) => hasPermission(user, perm),
    canSee: (moduleId: ModuleId) => hasModule(user, moduleId),
    /** Capacidad DENTRO de una herramienta. No abre «Administración»: son cajones distintos. */
    canUse: (tool: ToolPermissionKey) => hasTool(user, tool),
    canOpenAdmin: hasAnyAdminPermission(user),
  }), [user]);
}
