/** What a visitor may learn about an invite code before signing up. Never the campaign id. */
export interface InvitePreview {
  code: string;
  campaignName: string;
  systemId: string;
  dmName: string;
  seatsFree: number;
}

export interface IInviteRepository {
  /** `null` for unknown / disabled / archived codes. Full campaigns still preview (seatsFree = 0). */
  preview(code: string): Promise<InvitePreview | null>;
}
