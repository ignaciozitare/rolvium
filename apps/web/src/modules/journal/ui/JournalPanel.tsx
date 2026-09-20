import { useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { buildDocIndex } from '@rolvium/core';
import { DocIndexPanel, RichTextEditor, type RichTextEditorLabels } from '@rolvium/ui';
import { journalPort as defaultJournal } from '../container';
import type { JournalPort } from '../domain/ports/JournalPort';
import { useJournalDoc, type JournalKind } from './useJournalDoc';
import './journal.css';

interface Props {
  kind: JournalKind;
  campaignId: string;
  myUserId: string;
  journal?: JournalPort;
}

/** «guardado hace un momento / hace 3 min / hace 1 h», que es lo que dice el diseño — no una hora exacta. */
function savedAgo(t: (k: string, p?: Record<string, string>) => string, at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return t('journal.savedJustNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('journal.savedMinutes', { n: String(minutes) });
  return t('journal.savedHours', { n: String(Math.round(minutes / 60)) });
}

/**
 * NOTAS Y BITÁCORA (H9) dentro del carril lateral de la mesa, donde hasta hoy salía «próximamente».
 * Diseño: `rolvium.pen` § 4 · `Mesa/Plenilunio · Notas y Bitácora · con ÍNDICE`.
 *
 * Las dos superficies son la MISMA pantalla con dos diferencias, y por eso es un solo componente: de quién es
 * el documento (`kind`) y lo que avisa la línea de arriba. El editor es el compartido de `@rolvium/ui`.
 * El ÍNDICE se abre **al lado del carril, sobre la mesa**, no dentro del texto (orden suya, 2026-09-19).
 */
export function JournalPanel({ kind, campaignId, myUserId, journal = defaultJournal }: Props): JSX.Element {
  const { t } = useTranslation();
  const { doc, edit, load, save, savedAt, flush, reload } = useJournalDoc(kind, campaignId, myUserId, journal);
  const [indexOpen, setIndexOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // El «hace un momento» tiene que envejecer solo; cada 15 s basta y no se nota.
  useEffect(() => {
    if (savedAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 15000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, [savedAt]);

  // Cmd+S (o Ctrl+S) fuerza el guardado, como en la ficha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

  const labels: RichTextEditorLabels = {
    toolbar: t('journal.editor.toolbar'), h1: t('journal.editor.h1'), h2: t('journal.editor.h2'),
    bold: t('journal.editor.bold'), italic: t('journal.editor.italic'),
    bulleted: t('journal.editor.bulleted'), numbered: t('journal.editor.numbered'),
    quote: t('journal.editor.quote'), divider: t('journal.editor.divider'),
    quoteLabel: t('journal.editor.quoteLabel'), placeholder: t(`journal.${kind}.placeholder`),
    textField: t('journal.editor.textField'), removeBlock: t('journal.editor.removeBlock'),
  };

  if (load === 'loading') return <p className="jr-state" aria-live="polite">{t('journal.loading')}</p>;
  if (load === 'error') {
    return (
      <div className="jr-state" aria-live="polite">
        <p>{t('journal.loadError')}</p>
        <button type="button" className="jr-link" onClick={reload}>{t('journal.retry')}</button>
      </div>
    );
  }

  return (
    <div className="jr-panel">
      <p className="jr-hint">{t(`journal.${kind}.hint`)}</p>

      <div className="jr-bar">
        <button
          type="button" className={`jr-index-btn${indexOpen ? ' on' : ''}`}
          aria-pressed={indexOpen} onClick={() => setIndexOpen(v => !v)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">toc</span>
          {t('journal.index')}
        </button>
        <span className="jr-saved" aria-live="polite">
          {save === 'saving' ? t('journal.saving')
            : save === 'error' ? t('journal.saveError')
              : save === 'conflict' ? t('journal.conflict')
                : save === 'too_big' ? t('journal.tooBig')
                  : savedAt !== null ? savedAgo(t, savedAt, now) : ''}
        </span>
      </div>

      {save === 'conflict' && (
        <p className="jr-conflict" role="alert">
          {t('journal.conflictHelp')}
          <button type="button" className="jr-link" onClick={reload}>{t('journal.reload')}</button>
        </p>
      )}

      {indexOpen && (
        <div className="jr-index-float">
          <DocIndexPanel
            entries={buildDocIndex(doc)}
            onClose={() => setIndexOpen(false)}
            labels={{ title: t('journal.index'), empty: t('journal.indexEmpty'), close: t('journal.indexClose') }}
            onJump={id => document.getElementById(`rt-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        </div>
      )}

      <RichTextEditor doc={doc} onChange={edit} labels={labels} className="jr-editor" />
    </div>
  );
}
