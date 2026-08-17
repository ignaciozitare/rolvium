import type { InvitePreview } from '../entities/Identity';

/** Public invite preview (served by the Rolvium API with the service role). */
export interface InvitePort {
  /** `null` when the code is invalid, disabled, archived or full — the reason is never revealed. */
  preview(code: string): Promise<InvitePreview | null>;
}
