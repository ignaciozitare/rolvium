import { supabase } from '@/shared/lib/supabaseClient';
import { campaignsRepo } from '@/modules/campaigns/container';
import { SupabaseChatRepo } from './infra/SupabaseChatRepo';
import { HttpChatRollsAdapter } from './infra/HttpChatRollsAdapter';
import type { ChatPort } from './domain/ports/ChatPort';
import type { ChatRollsPort } from './domain/ports/ChatRollsPort';

export const chatPort: ChatPort = new SupabaseChatRepo(supabase, campaignsRepo);
export const chatRollsPort: ChatRollsPort = new HttpChatRollsAdapter();
