import { describe, it, expect } from 'vitest';
import type { User } from '@rolvium/shared-types';
import { renderWithProviders, screen } from '../../../tests/helpers/render';
import { fakeAuthRepo, PLAYER_USER } from '../../../tests/helpers/fakes';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { usePermissions } from './usePermissions';

/** Sonda: enseña en pantalla lo que el hook responde, para poder afirmarlo sin montar media app. */
function Sonda(): JSX.Element {
  const { canUse, canOpenAdmin, isAdmin } = usePermissions();
  return (
    <ul>
      <li data-testid="canUse">{String(canUse('manage_textures'))}</li>
      <li data-testid="canOpenAdmin">{String(canOpenAdmin)}</li>
      <li data-testid="isAdmin">{String(isAdmin)}</li>
    </ul>
  );
}

const conUsuario = async (user: User | null): Promise<void> => {
  renderWithProviders(<AuthProvider repo={fakeAuthRepo(user)}><Sonda /></AuthProvider>);
  // El proveedor carga el usuario en un efecto: hay que esperar a que llegue.
  await screen.findByTestId('canUse');
};

const esperar = async (id: string, valor: string): Promise<void> => {
  await screen.findByText(valor, { selector: `[data-testid="${id}"]` });
};

const DIRECTOR: User = {
  ...PLAYER_USER, id: 'u-dm', name: 'Laura', role: 'game_master',
  permissions: { modules: [], admin: {}, tools: { manage_textures: true } },
};

/**
 * 🔒 EL HOOK ES POR DONDE PASA TODA LA APP, así que el cepo tiene que estar también aquí: `canUse` y
 * `canOpenAdmin` leen cajones DISTINTOS. Si algún día se cablearan al mismo, el director con
 * `manage_textures` vería «Administración» en el menú y aterrizaría en una pantalla vacía.
 */
describe('usePermissions — `canUse` no abre «Administración»', () => {
  it('un director con el permiso de texturas lo puede usar, y NO ve Administración', async () => {
    await conUsuario(DIRECTOR);
    await esperar('canUse', 'true');
    await esperar('canOpenAdmin', 'false');   // ← el cepo
    await esperar('isAdmin', 'false');
  });

  it('un jugador sin el permiso no lo puede usar', async () => {
    await conUsuario(PLAYER_USER);
    await esperar('canUse', 'false');
    await esperar('canOpenAdmin', 'false');
  });

  it('un rol de antes del cajón `tools` no revienta: simplemente no lo tiene', async () => {
    await conUsuario({ ...PLAYER_USER, permissions: { modules: [], admin: {} } });
    await esperar('canUse', 'false');
  });

  it('el admin lo tiene por definición, sin que se le escriba nada', async () => {
    // Importa que sea así: el trigger `roles_guard_system` PROHÍBE tocar los permisos del rol admin.
    await conUsuario({ ...PLAYER_USER, id: 'u-root', role: 'admin', permissions: { modules: [], admin: { manage_users: true }, tools: {} } });
    await esperar('canUse', 'true');
    await esperar('isAdmin', 'true');
  });

  it('sin sesión no se puede nada', async () => {
    await conUsuario(null);
    await esperar('canUse', 'false');
    await esperar('canOpenAdmin', 'false');
  });
});
