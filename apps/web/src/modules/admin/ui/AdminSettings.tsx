import { useTranslation } from '@rolvium/i18n';

export function AdminSettings(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <div className="rv-page-title">{t('admin.settingsTitle')}</div>
      <div className="rv-page-sub">{t('admin.settingsEmpty')}</div>
    </div>
  );
}
