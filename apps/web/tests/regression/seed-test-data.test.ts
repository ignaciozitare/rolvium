import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSheet } from '@rolvium/core';
import { sheetSchema, budgetOf } from '@rolvium/system-plenilunio';

/**
 * Pin del borrado del 2026-08-31.
 *
 * A las 00:58 de esa madrugada un `npm run db:reset` se llevó por delante la campaña del dueño, el
 * personaje Karen Sinclair, el bestiario y el mapa con sus paredes. Vivían SÓLO en la base local y no
 * había copia. La regla de «usar `supabase migration up --local`, nunca `db reset`» ya estaba escrita
 * en WORK_STATE.md y se saltó igual: una regla que depende de que alguien se acuerde no es una regla.
 *
 * El arreglo fue mover esos datos a `supabase/seed.sql`, que se re-ejecuta en CADA reset. Este test
 * vigila las dos formas en que ese arreglo se puede pudrir en silencio:
 *
 *  1. Que la ficha de Karen deje de ser válida porque el esquema del sistema cambió. Nada la valida al
 *     insertarse — `characters.data` es `jsonb` y la base traga lo que le eches —, así que el fallo no
 *     saldría hasta que él abriera la ficha y la viera rota.
 *  2. Que una imagen del seed apunte a un fichero cuya fila de `storage.objects` el seed no rehace.
 *     Storage sirve por FILA, no por fichero: sin la fila el retrato da 404 aunque el .webp siga en el
 *     volumen. Es exactamente lo que pasó con los cuatro PNJs.
 */

const SEED = readFileSync(resolve(__dirname, '../../../../supabase/seed.sql'), 'utf8');

/** La ficha de Karen tal y como la inserta el seed: el `'{...}'::jsonb` que sigue a su nombre. */
function karenSheet(): Record<string, unknown> {
  const at = SEED.indexOf("'Karen Sinclair'");
  expect(at, 'el seed ya no inserta a Karen Sinclair').toBeGreaterThan(-1);
  const json = SEED.slice(at).match(/'(\{.*?\})'::jsonb/s)?.[1];
  expect(json, 'no se encuentra la ficha de Karen en el seed').toBeDefined();
  return JSON.parse(json!) as Record<string, unknown>;
}

describe('supabase/seed.sql · los datos de prueba que sobreviven a un db:reset', () => {
  it('la ficha de Karen sigue siendo válida contra el esquema de Plenilunio', () => {
    expect(validateSheet(sheetSchema, karenSheet())).toEqual([]);
  });

  it('Karen sigue cuadrando de creación: ni le sobran ni le faltan puntos', () => {
    const b = budgetOf(karenSheet());
    expect(b.available, 'puntos de característica sin cuadrar').toBe(0);
    expect(b.giftsSpent, 'los dones de Karen ya no cuadran con los que puede pagar').toBe(b.giftPoints);
  });

  it('mantiene los ids originales, para que el reset devuelva lo MISMO que se perdió', () => {
    expect(SEED).toContain('8f506705-e348-415c-82a9-5a37e2c0ce51');   // la campaña
    expect(SEED).toContain('3af4f238-25ad-4cf1-a264-09d7586019d8');   // Karen
  });

  it('toda imagen que referencia tiene su fila de storage.objects en el mismo seed', () => {
    const referenced = [...SEED.matchAll(/\/storage\/v1\/object\/public\/([a-z0-9_-]+)\/(\S+?)['\s,)]/g)]
      .map(m => `${m[1]}/${m[2]}`);
    expect(referenced.length, 'el seed ya no referencia ninguna imagen').toBeGreaterThan(0);

    // Las filas se leen SÓLO dentro del `INSERT INTO storage.objects`, acotado hasta su `;`: fuera de
    // ese bloque hay tuplas `('uuid', 'uuid')` (campaigns_members) que si no se colarían como ficheros.
    // El nombre de bucket usa el MISMO patrón en los dos lados a propósito. Con una lista fija aquí
    // (`avatars|tokens|backgrounds`) y un `[a-z]+` allí, los dos lados podían discrepar: un bucket con
    // guion o dígito no lo cogía el de arriba y su imagen quedaba sin comprobar EN SILENCIO — justo el
    // 404 que este test existe para cazar.
    const at = SEED.indexOf('INSERT INTO storage.objects');
    expect(at, 'el seed ya no rehace filas de storage.objects').toBeGreaterThan(-1);
    const stored = new Set(
      [...SEED.slice(at, SEED.indexOf(';', at)).matchAll(/\('([a-z0-9_-]+)',\s*'([^']+)'/g)]
        .map(m => `${m[1]}/${m[2]}`),
    );
    const huerfanas = [...new Set(referenced)].filter(r => !stored.has(r));
    expect(huerfanas, 'estas imágenes darían 404 tras un db:reset').toEqual([]);
  });
});
