import { useTranslation } from '@rolvium/i18n';
import { Card } from '@rolvium/ui';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { usePermissions } from '@/shared/permissions/usePermissions';
import { GRANTABLE_MODULES } from '@/shared/modules/registry';

export function HomePage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canSee } = usePermissions();
  const navigate = useNavigate();
  const mods = GRANTABLE_MODULES.filter(m => canSee(m.id));

  return (
    <div>
      <div className="rv-page-title">{t('home.welcome', { name: user?.name ?? '' })}</div>
      {mods.length === 0 ? (
        <div className="rv-page-sub">{t('home.empty')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {mods.map(m => (
            <Card key={m.id} onClick={() => navigate(m.path)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)', color: 'var(--ac2)' }}>{m.icon}</span>
                <span style={{ fontWeight: 600 }}>{t(m.labelKey)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
