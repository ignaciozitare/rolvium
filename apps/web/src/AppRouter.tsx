import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { LoginPage } from '@/modules/auth/ui/LoginPage';
import { HomePage } from '@/modules/home/ui/HomePage';
import { AdminShell } from '@/modules/admin/ui/AdminShell';
import { UIKit } from '@/shared/ui/UIKit';
import { RolviumApp } from './RolviumApp';

const Blank = () => <div style={{ background: 'var(--bg)', minHeight: '100vh' }} />;

function Protected({ children }: { children: JSX.Element }): JSX.Element {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Blank />;
  return user ? <RolviumApp>{children}</RolviumApp> : <Navigate to="/login" replace />;
}

function Public({ children }: { children: JSX.Element }): JSX.Element {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Blank />;
  return user ? <Navigate to="/home" replace /> : children;
}

/** Route table. Each new module registers here + in shared/modules/registry.ts */
export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<Public><LoginPage /></Public>} />
      <Route path="/home" element={<Protected><HomePage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminShell /></Protected>} />
      <Route path="/ui-kit" element={<Protected><UIKit /></Protected>} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export function AppRouter(): JSX.Element {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
