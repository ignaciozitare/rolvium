import type { SceneVision } from '@rolvium/core';
import { apiFetch } from '@/shared/lib/api';
import type { VisionPort } from '../domain/ports/VisionPort';

/** `POST /scenes/:id/vision` and `POST /scenes/:id/fog` on the Rolvium API (apps/api/src/infrastructure/http/mapsRoutes.ts). */
export class HttpVisionAdapter implements VisionPort {
  private post(sceneId: string, path: 'vision' | 'fog', body?: unknown): Promise<SceneVision> {
    return apiFetch<SceneVision>(`/scenes/${sceneId}/${path}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  refresh(sceneId: string, at?: { tokenId: string; x: number; y: number }): Promise<SceneVision> { return this.post(sceneId, 'vision', at ? { at } : undefined); }
  paint(sceneId: string, op: 'reveal' | 'hide', at: { x: number; y: number; radius: number }): Promise<SceneVision> {
    return this.post(sceneId, 'fog', { op, at });
  }
  paintAll(sceneId: string, op: 'reveal' | 'hide'): Promise<SceneVision> { return this.post(sceneId, 'fog', { op, all: true }); }
}
