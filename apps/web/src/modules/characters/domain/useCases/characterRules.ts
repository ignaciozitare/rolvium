import type { Character } from '../entities/Character';

/** Avatar precedence: character's own → owner's account avatar → initials (handled by <UserAvatar>). */
export function characterAvatar(c: Pick<Character, 'avatarUrl'>, ownerAvatarUrl: string | null | undefined): string | null {
  return c.avatarUrl ?? ownerAvatarUrl ?? null;
}

export function canEditCharacter(c: Pick<Character, 'ownerId'>, me: string | null, isDm: boolean): boolean {
  return isDm || (!!me && c.ownerId === me);
}

export function isUnassigned(c: Pick<Character, 'ownerId' | 'kind'>): boolean {
  return c.kind === 'pc' && c.ownerId === null;
}

/** Group by campaign for the /characters page, keeping campaign order of first appearance. */
export function groupByCampaign(list: Character[]): { campaignId: string; campaignName: string; characters: Character[] }[] {
  const out: { campaignId: string; campaignName: string; characters: Character[] }[] = [];
  for (const c of list) {
    let g = out.find(x => x.campaignId === c.campaignId);
    if (!g) { g = { campaignId: c.campaignId, campaignName: c.campaignName, characters: [] }; out.push(g); }
    g.characters.push(c);
  }
  return out;
}
