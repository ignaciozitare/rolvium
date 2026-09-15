import { apiFetch } from '@/shared/lib/api';
import type { ChatRollInput, ChatRollsPort } from '../domain/ports/ChatRollsPort';

/** `POST /chat/rolls` on the Rolvium API — the dice are generated and logged server-side, into `chat_messages`. */
export class HttpChatRollsAdapter implements ChatRollsPort {
  constructor(private readonly fetcher: typeof apiFetch = apiFetch) {}
  async roll(req: ChatRollInput): Promise<{ id: string } | null> {
    try {
      const res = await this.fetcher<{ id: string }>('/chat/rolls', { method: 'POST', body: JSON.stringify(req) });
      return res && res.id ? res : null;
    } catch {
      return null;
    }
  }
}
