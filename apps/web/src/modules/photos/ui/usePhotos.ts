import { useCallback, useEffect, useMemo, useState } from 'react';
import { CompressError, compressImage, type CompressionLevel } from '@rolvium/ui';
import { compressionLevelsRepo } from '@/shared/settings/container';
import { DEFAULT_COMPRESSION_LEVELS } from '@/shared/settings/compressionLevels';
import { photosPort } from '../container';
import type { PhotosPort } from '../domain/ports/PhotosPort';
import type { Photo } from '../domain/entities/Photo';
import { cleanPhotoName, nameFromFile, searchPhotos } from '../domain/useCases/photoRules';

/** Una subida en marcha. Vive sólo mientras dura: lo que se guarda es la foto, no esto. */
export interface Upload {
  /** Del navegador, para poder reintentar el MISMO fichero sin volver a elegirlo. */
  key: string;
  fileName: string;
  state: 'compressing' | 'uploading' | 'done' | 'failed';
  /** Lo que ocupaba y lo que ocupa: «2,4 MB → 180 KB». Sólo cuando ya se ha comprimido. */
  before?: number;
  after?: number;
  /** Clave i18n del motivo, cuando falla. */
  error?: string;
}

interface Options { campaignId: string; repo?: PhotosPort }

/** Qué clave de i18n le toca a un fallo de compresión. Lo que no reconocemos se cuenta como «no ha entrado». */
const errorKeyOf = (e: unknown): string =>
  e instanceof CompressError
    ? ({ mime: 'photos.error.mime', 'input-too-large': 'photos.error.tooBig', 'output-too-large': 'photos.error.stillTooBig', decode: 'photos.error.decode' }[e.code] ?? 'photos.error.upload')
    : 'photos.error.upload';

/**
 * LA BIBLIOTECA DE FOTOS de una campaña (H13) — lista, busca, sube, renombra y borra.
 * Spec: `specs/modules/photos/SPEC.md`.
 *
 * Los ENLACES de las fotos se firman aparte (`urlsFor`) y caducan: se piden para lo que hay que pintar y se
 * vuelven a pedir al recargar. No se guardan en la fila, que es lo que haría pública una foto privada.
 */
export function usePhotos({ campaignId, repo = photosPort }: Options) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [level, setLevel] = useState<CompressionLevel>(DEFAULT_COMPRESSION_LEVELS.photo);

  // El nivel lo pone un admin para TODOS en Ajustes; si no se puede leer, el de serie y a subir igual.
  useEffect(() => {
    let alive = true;
    void compressionLevelsRepo.load()
      .then(saved => { if (alive && saved) setLevel(saved.photo); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await repo.list(campaignId);
      setPhotos(rows);
      setUrls(await repo.urlsFor(campaignId, rows.map(p => p.id)).catch(() => ({})));
    } catch {
      setError('photos.error.load');
    } finally {
      setLoading(false);
    }
  }, [campaignId, repo]);

  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => searchPhotos(photos, query), [photos, query]);

  /**
   * SUBIR. Una a una a propósito, aunque se elijan diez: así cada una cuenta su propio estado y **un fichero
   * rechazado no se lleva a los demás** (spec § States & errors). Comprime en el navegador, como las texturas.
   */
  const upload = useCallback(async (files: readonly File[], fallbackName: string) => {
    if (!files.length) return;
    const nuevos: Upload[] = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, fileName: f.name, state: 'compressing' }));
    setUploads(prev => [...prev, ...nuevos]);
    const patch = (key: string, next: Partial<Upload>) => setUploads(prev => prev.map(u => (u.key === key ? { ...u, ...next } : u)));

    for (const [i, file] of files.entries()) {
      const key = nuevos[i]!.key;
      try {
        const out = await compressImage(file, 'photo', level);
        patch(key, { state: 'uploading', before: out.originalBytes, after: out.bytes });
        await repo.create(campaignId, {
          name: nameFromFile(file.name, fallbackName), width: out.width, height: out.height, file: out.blob,
        });
        patch(key, { state: 'done' });
      } catch (e) {
        patch(key, { state: 'failed', error: errorKeyOf(e) });
      }
    }
    await reload();
  }, [campaignId, level, repo, reload]);

  /** Quitar una subida de la lista: ya está guardada, o el director ya ha leído por qué no entró. */
  const dismiss = useCallback((key: string) => setUploads(prev => prev.filter(u => u.key !== key)), []);

  const rename = useCallback(async (photo: Photo, raw: string) => {
    const name = cleanPhotoName(raw);
    // Un nombre vacío no borra el que tenía: se deja como estaba, que es lo que espera quien pulsa Escape.
    if (!name || name === photo.name) return;
    setPhotos(prev => prev.map(p => (p.id === photo.id ? { ...p, name } : p)));
    try {
      await repo.rename(photo.id, name);
    } catch {
      setError('photos.error.rename');
      await reload();
    }
  }, [repo, reload]);

  const remove = useCallback(async (photo: Photo) => {
    try {
      await repo.remove(photo);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch {
      setError('photos.error.remove');
      await reload();
    }
  }, [repo, reload]);

  const usage = useCallback((photo: Photo) => repo.usage(photo), [repo]);

  return { photos, visible, urls, loading, error, setError, query, setQuery, uploads, upload, dismiss, rename, remove, usage, reload, level };
}
