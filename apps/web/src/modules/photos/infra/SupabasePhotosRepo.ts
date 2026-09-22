import type { SupabaseClient } from '@supabase/supabase-js';
import { photoObjectPath, type NewPhoto, type Photo, type PhotoUsage } from '../domain/entities/Photo';
import type { PhotosPort } from '../domain/ports/PhotosPort';

interface PhotoRow { id: string; campaign_id: string; name: string; width: number; height: number; created_at: string }

const COLS = 'id, campaign_id, name, width, height, created_at';
/** El bucket PRIVADO (`20260922120000_photos_biblioteca.sql`): nada de enlaces públicos aquí. */
export const PHOTOS_BUCKET = 'photos';
/** Una hora: lo que dura una sesión larga de mesa sin volver a pedirlos. Al recargar se firman otra vez. */
export const SIGNED_URL_SECONDS = 60 * 60;

export const mapPhotoRow = (r: PhotoRow): Photo => ({
  id: r.id, campaignId: r.campaign_id, name: r.name, width: r.width, height: r.height, createdAt: r.created_at,
});

/**
 * LA BIBLIOTECA DE FOTOS contra Supabase (H13). Ni un filtro de permisos escrito a mano: la tabla sólo existe
 * para el director de la campaña, y el fichero sólo se firma a quien la base deje leerlo.
 */
export class SupabasePhotosRepo implements PhotosPort {
  constructor(private readonly db: SupabaseClient) {}

  async list(campaignId: string): Promise<Photo[]> {
    const { data, error } = await this.db.from('photos_photos').select(COLS)
      .eq('campaign_id', campaignId).order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as PhotoRow[]).map(mapPhotoRow);
  }

  async create(campaignId: string, photo: NewPhoto): Promise<Photo> {
    const { data, error } = await this.db.from('photos_photos')
      .insert({ campaign_id: campaignId, name: photo.name, width: photo.width, height: photo.height })
      .select(COLS).single();
    if (error) throw error;
    const created = mapPhotoRow(data as PhotoRow);

    // El fichero va DESPUÉS de la fila porque el bucket sólo acepta ficheros de fotos que ya existen.
    const upload = await this.db.storage.from(PHOTOS_BUCKET)
      .upload(photoObjectPath(campaignId, created.id), photo.file, { contentType: photo.file.type || 'image/webp', upsert: false });
    if (upload.error) {
      // Si no sube, la fila no se queda huérfana en la biblioteca: se deshace, y el fallo se cuenta tal cual.
      await this.db.from('photos_photos').delete().eq('id', created.id);
      throw upload.error;
    }
    return created;
  }

  async rename(photoId: string, name: string): Promise<Photo> {
    const { data, error } = await this.db.from('photos_photos').update({ name }).eq('id', photoId).select(COLS).single();
    if (error) throw error;
    return mapPhotoRow(data as PhotoRow);
  }

  async remove(photo: Pick<Photo, 'id' | 'campaignId'>): Promise<void> {
    // Primero la fila: es lo que la quita de las escenas y del chat. Si el fichero luego no se borra, queda un
    // fichero que ya nadie más que el director puede leer (deuda de limpieza, como la de `core/images`).
    const { error } = await this.db.from('photos_photos').delete().eq('id', photo.id);
    if (error) throw error;
    await this.db.storage.from(PHOTOS_BUCKET).remove([photoObjectPath(photo.campaignId, photo.id)]);
  }

  async usage(photo: Pick<Photo, 'id' | 'campaignId'>): Promise<PhotoUsage> {
    const [adventures, scenes, messages] = await Promise.all([
      // Dentro del documento no hay clave ajena: se busca el bloque `image` que la apunta.
      this.db.from('adventures_adventures').select('id, title')
        .eq('campaign_id', photo.campaignId).contains('doc', { blocks: [{ type: 'image', photoId: photo.id }] }),
      this.db.from('maps_scene_props').select('scene_id, maps_scenes(name)').eq('photo_id', photo.id),
      this.db.from('chat_messages').select('id', { count: 'exact', head: true }).eq('photo_id', photo.id),
    ]);
    if (adventures.error) throw adventures.error;
    if (scenes.error) throw scenes.error;
    if (messages.error) throw messages.error;

    // Una foto puede estar dos veces en la misma escena (se copia): la escena se nombra una vez.
    const byScene = new Map<string, string>();
    for (const r of (scenes.data ?? []) as unknown as { scene_id: string; maps_scenes: { name: string } | null }[]) {
      byScene.set(r.scene_id, r.maps_scenes?.name ?? '');
    }
    return {
      adventures: ((adventures.data ?? []) as { id: string; title: string }[]).map(a => ({ id: a.id, title: a.title })),
      scenes: [...byScene].map(([id, name]) => ({ id, name })),
      messages: messages.count ?? 0,
    };
  }

  async urlsFor(campaignId: string, photoIds: readonly string[]): Promise<Record<string, string>> {
    const ids = [...new Set(photoIds)];
    if (!ids.length) return {};
    const paths = ids.map(id => photoObjectPath(campaignId, id));
    const { data, error } = await this.db.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    const out: Record<string, string> = {};
    for (const [i, row] of (data ?? []).entries()) {
      // Lo que la base no deja leer viene con error y sin enlace: se deja fuera, no se inventa.
      const id = ids[i];
      if (id && row.signedUrl && !row.error) out[id] = row.signedUrl;
    }
    return out;
  }
}
