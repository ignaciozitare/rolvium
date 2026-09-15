import { describe, it, expect, vi } from 'vitest';
import type { ChatRollInput } from '../domain/ports/ChatRollsPort';
import { HttpChatRollsAdapter } from './HttpChatRollsAdapter';

const REQ: ChatRollInput = { conversationId: 'conv1', systemId: null, kind: 'free', title: '2D6', groups: [{ count: 2, sides: 6 }], visibility: 'table' };

describe('HttpChatRollsAdapter', () => {
  it('posts the request (with conversationId) to /chat/rolls and returns the new id', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'msg-1' });
    const res = await new HttpChatRollsAdapter(fetcher as never).roll(REQ);
    expect(fetcher).toHaveBeenCalledWith('/chat/rolls', expect.objectContaining({ method: 'POST', body: JSON.stringify(REQ) }));
    expect(res).toEqual({ id: 'msg-1' });
  });
  it('returns null on failure, empty body or a body without id', async () => {
    expect(await new HttpChatRollsAdapter(vi.fn().mockRejectedValue(new Error('down')) as never).roll(REQ)).toBeNull();
    expect(await new HttpChatRollsAdapter(vi.fn().mockResolvedValue(undefined) as never).roll(REQ)).toBeNull();
    expect(await new HttpChatRollsAdapter(vi.fn().mockResolvedValue({}) as never).roll(REQ)).toBeNull();
  });
});
