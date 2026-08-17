import { useTranslation } from '@rolvium/i18n';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { ProgressionPanel } from '@/modules/characters/ui/ProgressionPanel';
import { useCharacterSheet } from '@/modules/characters/ui/useCharacterSheet';
import { useMyCharacter } from './SheetTab';

interface Props { campaignId: string; userId: string; repo: CharactersPort; progressionEnabled: boolean; characterId?: string | null }

/** Mejorar tab: progression for my character, gated by the campaign's `progressionEnabled`. */
export function ImproveTab({ campaignId, userId, repo, progressionEnabled, characterId }: Props): JSX.Element {
  const { t } = useTranslation();
  const my = useMyCharacter(campaignId, userId, repo, characterId);
  const state = useCharacterSheet(my.ready ? my.id : null, repo);
  if (!my.ready || (my.id && state.status === 'loading')) return <section className="tb-hoja tb-placeholder">{t('common.loading')}</section>;
  if (!my.id || state.status !== 'ready') return <section className="ch-empty"><h3>{t('characters.progression.title')}</h3><p>{t('characters.progression.noCharacter')}</p></section>;
  return <ProgressionPanel state={state} enabled={progressionEnabled} />;
}
