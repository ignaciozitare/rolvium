import { useTranslation } from '@rolvium/i18n';
import { UserAvatar } from '@rolvium/ui';
import type { ChatMessage } from '../domain/entities/Chat';

interface Props {
  message: ChatMessage;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * La pastilla (`rolvium.pen` `m4fh05`): salta sobre la mesa cuando alguien te susurra. Se pincha y abre esa
 * conversación en SUSURROS sin salir de la partida; si no, se va sola (temporizador en `WhisperWatcher`).
 */
export function WhisperPill({ message, onOpen, onDismiss }: Props): JSX.Element {
  const { t } = useTranslation();
  const preview = message.kind === 'text' ? message.body
    : message.kind === 'roll' ? t('chat.directory.rollPreview')
    : t('chat.directory.rollRefPreview');
  return (
    <div className="ch-pill" role="status">
      <button type="button" className="ch-pill-open" onClick={onOpen}>
        <UserAvatar user={{ name: message.authorName, avatarUrl: message.authorAvatarUrl }} size={26} />
        <span className="ch-pill-body">
          <span className="ch-pill-who">{t('chat.pill.whispers', { name: message.authorName })}</span>
          <span className="ch-pill-text">{preview}</span>
        </span>
      </button>
      <button type="button" className="ch-pill-x" onClick={onDismiss} aria-label={t('chat.pill.dismiss')}>
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
      </button>
    </div>
  );
}
