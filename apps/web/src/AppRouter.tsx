import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { LoginPage } from '@/modules/auth/ui/LoginPage';
import { SignupPage } from '@/modules/identity/ui/SignupPage';
import { ForgotPage } from '@/modules/identity/ui/ForgotPage';
import { ResetPage } from '@/modules/identity/ui/ResetPage';
import { AccountPage } from '@/modules/identity/ui/AccountPage';
import { CampaignsPage } from '@/modules/campaigns/ui/CampaignsPage';
import { TablePage } from '@/modules/table/ui/TablePage';
import { AdminShell } from '@/modules/admin/ui/AdminShell';
import { UIKit } from '@/shared/ui/UIKit';
import { RolviumApp } from './RolviumApp';

const Blank = () => <div style={{ background: 'var(--bg)', minHeight: '100vh' }} />;

function Protected({ children }: { children: JSX.Element }): JSX.Element {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Blank />;
  return user ? <RolviumApp>{children}</RolviumApp> : <Navigate to="/login" replace />;
}
/** Full-screen protected route without the platform shell (the table brings its own chrome). */
function ProtectedBare({ children }: { children: JSX.Element }): JSX.Element {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Blank />;
  return user ? children : <Navigate to="/login" replace />;
}

function Public({ children }: { children: JSX.Element }): JSX.Element {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Blank />;
  return user ? <Navigate to="/campaigns" replace /> : children;
}
/** Reachable signed-in or not (the page decides what to show — e.g. /join/:code). */
function Anyone({ children }: { children: JSX.Element }): JSX.Element {
  const { isLoading } = useAuth();
  if (isLoading) return <Blank />;
  return children;
}

/** Route table. Each new module registers here + in shared/modules/registry.ts */
export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<Public><LoginPage /></Public>} />
      <Route path="/signup" element={<Public><SignupPage /></Public>} />
      <Route path="/join" element={<Anyone><SignupPage /></Anyone>} />
      <Route path="/join/:code" element={<Anyone><SignupPage /></Anyone>} />
      <Route path="/forgot" element={<Public><ForgotPage /></Public>} />
      <Route path="/reset" element={<Anyone><ResetPage /></Anyone>} />
      <Route path="/account" element={<Protected><AccountPage /></Protected>} />
      <Route path="/campaigns" element={<Protected><CampaignsPage /></Protected>} />
      <Route path="/table/:id" element={<ProtectedBare><TablePage /></ProtectedBare>} />
      <Route path="/home" element={<Navigate to="/campaigns" replace />} />
      <Route path="/admin" element={<Protected><AdminShell /></Protected>} />
      <Route path="/ui-kit" element={<Protected><UIKit /></Protected>} />
      <Route path="/" element={<Navigate to="/campaigns" replace />} />
      <Route path="*" element={<Navigate to="/campaigns" replace />} />
    </Routes>
  );
}

export function AppRouter(): JSX.Element {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
