import { useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { buildDocIndex, type RichDoc } from '@rolvium/core';
import { DocIndexPanel, Modal, RichTextEditor, type RichTextEditorLabels } from '@rolvium/ui';
import type { Adventure } from '../domain/entities/Adventure';
import type { DocSave } from './useAdventureDoc';
import './adventures.css';

export interface AdventureScene { id: string; name: string }

interface Props {
  adventure: Adventure;
  doc: RichDoc;
  onChange: (doc: RichDoc) => void;
  onRename: (title: string) => void;
  save: DocSave;
  savedAt: number | null;
  onReload: () => void;
  /** Las escenas de esta aventura: son las que se pueden enlazar desde el texto. */
  scenes: readonly AdventureScene[];
  onOpenScene: (sceneId: string) => void;
  /** Sólo en la pestaña de la mesa: en la ventana aparte ya no tiene sentido. */
  onOpenApart?: (() => void) | undefined;
}

function savedText(t: (k: string, p?: Record<string, string>) => string, at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return t('adventures.savedJustNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('adventures.savedMinutes', { n: String(minutes) });
  return t('adventures.savedHours', { n: String(Math.round(minutes / 60)) });
}

/**
 * EL CUADERNO DE UNA AVENTURA: cabecera (título que se escribe, estado, guardado, ÍNDICE y ABRIR APARTE),
 * el índice al lado y el documento. **La misma pieza en los dos sitios** —la pestaña de la mesa y la ventana
 * aparte—, que es lo que garantiza que no se separen: `rolvium.pen` § 4, los dos marcos.
 */
export function AdventureDocument({
  adventure, doc, onChange, onRename, save, savedAt, onReload, scenes, onOpenScene, onOpenApart,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const [indexOpen, setIndexOpen] = useState(true);
  const [picking, setPicking] = useState<((picked: { sceneId: string; label: string } | null) => void) | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (savedAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 15000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, [savedAt]);

  const labels: RichTextEditorLabels = {
    toolbar: t('journal.editor.toolbar'), h1: t('journal.editor.h1'), h2: t('journal.editor.h2'),
    bold: t('journal.editor.bold'), italic: t('journal.editor.italic'),
    bulleted: t('journal.editor.bulleted'), numbered: t('journal.editor.numbered'),
    quote: t('journal.editor.quote'), divider: t('journal.editor.divider'),
    quoteLabel: t('journal.editor.quoteLabel'), placeholder: t('adventures.placeholder'),
    textField: t('journal.editor.textField'), removeBlock: t('journal.editor.removeBlock'),
    npcTable: t('adventures.npcTable'), encounterTable: t('adventures.encounterTable'),
    npcColumns: [t('adventures.col.npc'), t('adventures.col.what'), t('adventures.col.wants'), t('adventures.col.notes')],
    encounterColumns: [t('adventures.col.npc'), t('adventures.col.howMany'), t('adventures.col.difficulty'), t('adventures.col.notes')],
    addRow: t('adventures.addRow'), linkScene: t('adventures.linkScene'), openScene: t('adventures.openScene'),
  };

  return (
    <div className="av-doc">
      <header className="av-head">
        <input
          className="av-title" value={adventure.title} aria-label={t('adventures.titleField')}
          onChange={e => onRename(e.target.value)} maxLength={120}
        />
        <span className={`av-status av-status-${adventure.status}`}>{t(`adventures.status.${adventure.status}`)}</span>
        <span className="av-saved" aria-live="polite">
          {save === 'saving' ? t('adventures.saving')
            : save === 'error' ? t('adventures.saveError')
              : save === 'conflict' ? t('adventures.conflict')
                : savedAt !== null ? savedText(t, savedAt, now) : ''}
        </span>
        <button
          type="button" className={`av-btn${indexOpen ? ' on' : ''}`} aria-pressed={indexOpen}
          onClick={() => setIndexOpen(v => !v)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">toc</span>
          {t('journal.index')}
        </button>
        {onOpenApart && (
          <button type="button" className="av-btn" onClick={onOpenApart}>
            <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
            {t('adventures.openApart')}
          </button>
        )}
      </header>

      {save === 'conflict' && (
        <p className="av-conflict" role="alert">
          {t('adventures.conflictHelp')}
          <button type="button" className="av-link" onClick={onReload}>{t('journal.reload')}</button>
        </p>
      )}

      <div className="av-body">
        {indexOpen && (
          <DocIndexPanel
            className="av-index"
            entries={buildDocIndex(doc)}
            onClose={() => setIndexOpen(false)}
            labels={{ title: t('journal.index'), empty: t('journal.indexEmpty'), close: t('journal.indexClose') }}
            onJump={id => document.getElementById(`rt-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        )}
        <RichTextEditor
          className="av-editor" doc={doc} onChange={onChange} labels={labels}
          features={{ tables: true, sceneRef: true }}
          onOpenScene={onOpenScene}
          onPickScene={() => new Promise(resolve => setPicking(() => resolve))}
        />
      </div>

      {picking && (
        <Modal title={t('adventures.pickScene')} onClose={() => { picking(null); setPicking(null); }}>
          {scenes.length === 0
            ? <p className="av-empty">{t('adventures.noScenes')}</p>
            : (
              <ul className="av-picklist">
                {scenes.map(scene => (
                  <li key={scene.id}>
                    <button type="button" onClick={() => { picking({ sceneId: scene.id, label: scene.name }); setPicking(null); }}>
                      <span className="material-symbols-outlined" aria-hidden="true">map</span>
                      {scene.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Modal>
      )}
    </div>
  );
}
