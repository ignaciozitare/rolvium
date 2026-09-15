import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { UserAvatar } from '@rolvium/ui';
import type { ChatDirectoryEntry } from '../domain/entities/Chat';

interface Props {
  entries: ChatDirectoryEntry[];
  onOpen: (entry: ChatDirectoryEntry) => void;
  onCreateGroup: (memberIds: string[]) => void;
}

const previewOf = (entry: ChatDirectoryEntry, t: (key: string) => string): string | null => {
  if (entry.lastKind === 'text') return entry.lastBody;
  if (entry.lastKind === 'roll') return t('chat.directory.rollPreview');
  if (entry.lastKind === 'roll_ref') return t('chat.directory.rollRefPreview');
  return null;
};

/** SUSURROS · directorio (`rolvium.pen` `I9AY0o`): a quién le escribís, con la previsualización y el no leídos. */
export function Directory({ entries, onOpen, onCreateGroup }: Props): JSX.Element {
  const { t } = useTranslation();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (userId: string) => setSelected(s => { const next = new Set(s); next.has(userId) ? next.delete(userId) : next.add(userId); return next; });
  const confirmGroup = () => { onCreateGroup([...selected]); setSelected(new Set()); setSelecting(false); };
  const cancelGroup = () => { setSelected(new Set()); setSelecting(false); };

  return (
    <div className="ch-directory">
      <div className="ch-directory-head">
        <span className="ch-directory-title">{t('chat.directory.title')}</span>
        {selecting
          ? <span className="ch-directory-group-actions">
              <button type="button" className="ch-directory-newgroup" disabled={selected.size === 0} onClick={confirmGroup}>
                {t('chat.directory.confirmGroup', { n: String(selected.size) })}
              </button>
              <button type="button" className="ch-directory-cancel" onClick={cancelGroup} aria-label={t('chat.directory.cancelGroup')}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
              </button>
            </span>
          : <button type="button" className="ch-directory-newgroup" onClick={() => setSelecting(true)}>{t('chat.directory.newGroup')}</button>}
      </div>
      {entries.length === 0
        ? <p className="ch-directory-empty">{t('chat.directory.empty')}</p>
        : <ul className="ch-directory-list">
            {entries.map(entry => {
              const preview = previewOf(entry, t);
              const isChecked = !entry.isGroup && selected.has(entry.memberIds[0] ?? '');
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    className="ch-directory-row"
                    aria-pressed={selecting && !entry.isGroup ? isChecked : undefined}
                    onClick={() => (selecting && !entry.isGroup ? toggleSelect(entry.memberIds[0] ?? '') : onOpen(entry))}
                    disabled={selecting && entry.isGroup}
                  >
                    <UserAvatar user={{ name: entry.title, avatarUrl: null }} size={36} />
                    <span className="ch-directory-row-body">
                      <span className="ch-directory-row-name">{entry.title}</span>
                      <span className="ch-directory-row-preview">
                        {entry.isGroup ? t('chat.directory.groupOf', { n: String(entry.memberCount ?? 0) }) : preview ?? t(`table.role.${entry.role ?? 'player'}`)}
                      </span>
                    </span>
                    {selecting && !entry.isGroup && <span className={`ch-directory-check ${isChecked ? 'on' : ''}`} aria-hidden="true" />}
                    {!selecting && entry.unreadCount > 0 && <span className="ch-unread">{entry.unreadCount}</span>}
                  </button>
                </li>
              );
            })}
          </ul>}
      <p className="ch-directory-note">{t('chat.directory.note')}</p>
    </div>
  );
}
