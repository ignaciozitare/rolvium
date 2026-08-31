import { describe, it, expect } from 'vitest';
import {
  LAYERS_ALL, LAYER_CREATURES, LAYER_FLOOR, LAYER_MOSS, LAYER_NOTES, LAYER_OBJECTS, LAYER_PUDDLES,
  LIGHT_BULB, LIGHT_SECRET, LIGHT_TORCH, SCENE_WAREHOUSE,
} from '../../../../../tests/helpers/fakes';
import {
  canEditIn, clampRangeM, clampStrength, conePath, DEFAULT_MASK_STRENGTH, LIGHT_COLORS, MAX_RANGE_M, MIN_RANGE_M, FIXED_LAYER_KINDS, FLICKER, flickerOf, isFixedKind, isPainted,
  layerOfKind, layerSendsToPlayers, LIGHT_KINDS, LIGHT_PRESETS, LIGHT_SHAPES, lightRadiusPx, maskPath, maskSize, MASK_MAX_SIDE,
  maskSrc, newLightOf, nextTerrainSortOrder, paintedLights, paintOrder, panelOrder, rangeLabelM, reorderTerrain,
  strengthLabel, strokeDots, TERRAIN_WARN_AT, terrainLayers, terrainOverweight, toMaskPoint, MASK_DIRECTIONS,
} from './layerRules';

const ids = (ls: { id: string }[]): string[] => ls.map(l => l.id);

describe('el orden de las capas', () => {
  /**
   * El orden entre tipos NO se guarda porque no se elige: es el motor (terreno → objetos → criaturas →
   * notas del director). Lo que el director ordena es el terreno entre sí.
   */
  it('pinta de abajo arriba: terreno, objetos, criaturas y por último las notas del director', () => {
    expect(ids(paintOrder(LAYERS_ALL))).toEqual(['ly-floor', 'ly-moss', 'ly-pud', 'ly-obj', 'ly-cre', 'ly-dm']);
  });

  it('el panel se lee al revés que el pintado, como en cualquier editor', () => {
    expect(ids(panelOrder(LAYERS_ALL))).toEqual(['ly-dm', 'ly-cre', 'ly-obj', 'ly-pud', 'ly-moss', 'ly-floor']);
  });

  it('no muta la lista que recibe', () => {
    const original = [...LAYERS_ALL];
    paintOrder(LAYERS_ALL);
    panelOrder(LAYERS_ALL);
    expect(LAYERS_ALL).toEqual(original);
  });

  it('sólo el terreno lleva varias; de los otros tres hay uno y sólo uno', () => {
    expect(ids(terrainLayers(LAYERS_ALL))).toEqual(['ly-floor', 'ly-moss', 'ly-pud']);
    for (const k of FIXED_LAYER_KINDS) expect(isFixedKind(k)).toBe(true);
    expect(isFixedKind('terrain')).toBe(false);
    expect(layerOfKind(LAYERS_ALL, 'dm_notes')).toBe(LAYER_NOTES);
    expect(layerOfKind([], 'objects')).toBeNull();
  });
});

describe('«manda esto a otra capa» — dónde está de verdad un elemento', () => {
  /** Vacío = «su capa natural». Es lo que vale para todo lo dibujado antes de la rebanada 7. */
  it('sin capa, un dibujo cae en Objetos y una ficha en Criaturas', () => {
    expect(paintOrder(LAYERS_ALL).length).toBe(6);
    expect(LAYER_OBJECTS.kind).toBe('objects');
    expect(LAYER_CREATURES.kind).toBe('creatures');
  });
});

describe('qué viaja al navegador de un jugador', () => {
  /**
   * La regla dura del spec: la capa de notas NO se pinta oculta — no se envía. Aquí sólo se decide QUÉ SE
   * PINTA; quien de verdad corta es la RLS (`public.maps_layer_sends_to_players`).
   */
  it('las notas del director no viajan nunca, ni siquiera encendidas', () => {
    expect(layerSendsToPlayers(LAYER_NOTES)).toBe(false);
    expect(layerSendsToPlayers({ ...LAYER_NOTES, visible: true })).toBe(false);
  });

  it('una capa apagada tampoco viaja', () => {
    expect(layerSendsToPlayers(LAYER_PUDDLES)).toBe(false);
    expect(layerSendsToPlayers(LAYER_MOSS)).toBe(true);
  });

  it('sin capa (la natural) pasa: es todo lo que existía antes', () => {
    expect(layerSendsToPlayers(null)).toBe(true);
  });
});

describe('el ojo es el de Photoshop, no un interruptor de privacidad', () => {
  /**
   * Aclaración literal del dueño (2026-08-31): «las capas son para cada escena, es un recurso para lograr
   * cosas gráficas, como en photoshop». Apagada no se pinta para NADIE — el director tampoco la ve.
   */
  it('una capa apagada desaparece también para el director', () => {
    expect(isPainted(LAYER_PUDDLES, true)).toBe(false);
    expect(isPainted(LAYER_PUDDLES, false)).toBe(false);
  });

  it('las notas del director se le pintan a él y a nadie más', () => {
    expect(isPainted(LAYER_NOTES, true)).toBe(true);
    expect(isPainted(LAYER_NOTES, false)).toBe(false);
  });

  it('una capa apagada no se salva por ser de notas', () => {
    expect(isPainted({ ...LAYER_NOTES, visible: false }, true)).toBe(false);
  });

  it('sin capa se pinta siempre', () => {
    expect(isPainted(null, false)).toBe(true);
  });
});

describe('el candado', () => {
  /** Bloqueada = se ve pero no se toca. Es lo que evita arrastrar el terreno al mover una ficha. */
  it('impide editar en esa capa, y sólo en esa', () => {
    expect(canEditIn(LAYER_FLOOR)).toBe(false);
    expect(canEditIn(LAYER_MOSS)).toBe(true);
    expect(canEditIn(null)).toBe(true);
  });
});

describe('el terreno, sin límite pero con aviso', () => {
  /** «Sin límite» fue elección del dueño a sabiendas: la app AVISA cuando pesa, no bloquea. */
  it('avisa a partir del umbral, sin impedir nada', () => {
    expect(TERRAIN_WARN_AT).toBe(3);
    expect(terrainOverweight(LAYERS_ALL)).toBe(true);
    expect(terrainOverweight([LAYER_OBJECTS, LAYER_FLOOR, LAYER_MOSS])).toBe(false);
  });

  it('la capa nueva se coloca encima de todas las de terreno', () => {
    expect(nextTerrainSortOrder(LAYERS_ALL)).toBe(3);
    expect(nextTerrainSortOrder([LAYER_OBJECTS])).toBe(0);
  });
});

describe('reordenar el terreno', () => {
  it('intercambia sólo las dos filas que se mueven', () => {
    expect(reorderTerrain(LAYERS_ALL, 'ly-moss', 'up')).toEqual([{ id: 'ly-moss', sortOrder: 2 }, { id: 'ly-pud', sortOrder: 1 }]);
    expect(reorderTerrain(LAYERS_ALL, 'ly-moss', 'down')).toEqual([{ id: 'ly-moss', sortOrder: 0 }, { id: 'ly-floor', sortOrder: 1 }]);
  });

  it('no hace nada en los extremos ni con una capa que no existe', () => {
    expect(reorderTerrain(LAYERS_ALL, 'ly-floor', 'down')).toEqual([]);
    expect(reorderTerrain(LAYERS_ALL, 'ly-pud', 'up')).toEqual([]);
    expect(reorderTerrain(LAYERS_ALL, 'ly-nope', 'up')).toEqual([]);
  });
});

describe('la máscara del pincel de transparencia', () => {
  /** La política de almacenamiento mira `foldername[1]`, así que la campaña tiene que ir la primera. */
  it('vive bajo la carpeta de la campaña', () => {
    expect(maskPath('c1', 'ly-moss')).toBe('c1/masks/ly-moss.png');
    expect(maskPath('c1', 'ly-moss').split('/')[0]).toBe('c1');
  });

  it('se pide con la versión pegada, para que ningún navegador se quede con la vieja', () => {
    expect(maskSrc(LAYER_MOSS)).toBe('https://x/backgrounds/c1/masks/ly-moss.png?v=3');
    expect(maskSrc({ maskUrl: 'https://x/m.png?token=abc', maskVersion: 7 })).toBe('https://x/m.png?token=abc&v=7');
  });

  it('sin máscara la capa es opaca entera', () => {
    expect(maskSrc(LAYER_FLOOR)).toBeNull();
  });

  it('la fuerza va de 0 a 1 y aguanta basura', () => {
    expect(DEFAULT_MASK_STRENGTH).toBe(0.6);
    expect(clampStrength(1.4)).toBe(1);
    expect(clampStrength(-2)).toBe(0);
    expect(clampStrength(Number.NaN)).toBe(0);
    expect(strengthLabel(0.6)).toBe('60 %');
    expect(strengthLabel(1)).toBe('100 %');
  });

  it('la máscara se guarda reducida: el lado largo no pasa del tope', () => {
    const big = maskSize({ width: 4000, height: 2500 });
    expect(Math.max(big.width, big.height)).toBe(MASK_MAX_SIDE);
    expect(big.height).toBe(640);
  });

  it('una escena pequeña se guarda a su tamaño, sin estirarla', () => {
    expect(maskSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });

  it('una escena de las de siempre ya entra en la reducción', () => {
    expect(maskSize(SCENE_WAREHOUSE)).toEqual({ width: 1024, height: 640 });
  });
});

describe('las luces de ambiente', () => {
  it('cada tipo trae su color, su alcance y su forma', () => {
    for (const k of LIGHT_KINDS) {
      const p = LIGHT_PRESETS[k];
      expect(p.rangeM).toBeGreaterThan(0);
      expect(LIGHT_SHAPES).toContain(p.shape);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('una luz nueva nace con lo del tipo y en el sitio donde se pinchó', () => {
    const l = newLightOf('flashlight', { x: 120, y: 340 }, SCENE_WAREHOUSE);
    expect(l).toMatchObject({ sceneId: 'sc-1', campaignId: 'c1', kind: 'flashlight', shape: 'cone', x: 120, y: 340, rangeM: 9, layerId: null });
    // Lo que se guarda «para más adelante» arranca en falso, nunca indefinido.
    expect(l.castsShadow).toBe(false);
  });

  it('el alcance se mide en metros, como el resto de la mesa', () => {
    expect(rangeLabelM({ rangeM: 6 })).toBe('6');
    expect(rangeLabelM({ rangeM: 7.55 })).toBe('7.6');
    expect(lightRadiusPx(LIGHT_TORCH, SCENE_WAREHOUSE.grid)).toBeGreaterThan(0);
    expect(lightRadiusPx({ rangeM: 12 }, SCENE_WAREHOUSE.grid)).toBeGreaterThan(lightRadiusPx({ rangeM: 6 }, SCENE_WAREHOUSE.grid));
  });
});

describe('el parpadeo se anima, y el ritmo lo manda el tipo', () => {
  /**
   * Petición del dueño al aprobar el diseño (2026-08-31): «quiero que en algún momento tengan cierta
   * animación, como si fuera de una hoguera o una antorcha, o una luz que parpadea». Va por TIPO para que
   * el director sólo tenga que encender un interruptor.
   */
  it('sin el interruptor no se anima nada', () => {
    expect(flickerOf({ kind: 'torch', flicker: false })).toBeNull();
    expect(flickerOf(LIGHT_BULB)).toBeNull();
  });

  it('la antorcha tiembla rápido y poco; la hoguera respira lento y amplio', () => {
    const torch = flickerOf(LIGHT_TORCH)!;
    const fire = FLICKER.fire;
    expect(torch.periodMs).toBeLessThan(fire.periodMs);
    expect(torch.depth).toBeLessThan(fire.depth);
    expect(torch.sharp).toBe(false);
  });

  it('la bombilla da golpes secos, y es la única', () => {
    expect(FLICKER.bulb.sharp).toBe(true);
    expect(LIGHT_KINDS.filter(k => FLICKER[k].sharp)).toEqual(['bulb']);
  });

  it('ningún ritmo apaga la luz del todo ni se queda quieto', () => {
    for (const k of LIGHT_KINDS) {
      expect(FLICKER[k].depth).toBeGreaterThan(0);
      expect(FLICKER[k].depth).toBeLessThan(1);
      expect(FLICKER[k].periodMs).toBeGreaterThan(0);
    }
  });
});

describe('el cono', () => {
  it('sale del centro, abre lo que dice el ángulo y cierra', () => {
    const d = conePath({ x: 100, y: 100, rotation: 0, coneAngle: 90 }, 50);
    expect(d.startsWith('M100 100 L')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('A50 50');
  });

  it('un cono de más de media vuelta usa el arco largo', () => {
    expect(conePath({ x: 0, y: 0, rotation: 0, coneAngle: 270 }, 10)).toContain(' 0 1 1 ');
    expect(conePath({ x: 0, y: 0, rotation: 0, coneAngle: 90 }, 10)).toContain(' 0 0 1 ');
  });

  it('gira con la luz', () => {
    expect(conePath({ x: 0, y: 0, rotation: 0, coneAngle: 60 }, 10)).not.toBe(conePath({ x: 0, y: 0, rotation: 90, coneAngle: 60 }, 10));
  });
});

describe('qué luces se pintan', () => {
  const all = [LIGHT_TORCH, LIGHT_BULB, LIGHT_SECRET];

  it('la luz escondida en las notas del director es sólo suya', () => {
    expect(ids(paintedLights(all, LAYERS_ALL, true))).toEqual(['li-torch', 'li-bulb', 'li-secret']);
    expect(ids(paintedLights(all, LAYERS_ALL, false))).toEqual(['li-torch', 'li-bulb']);
  });

  it('apagar la capa de objetos apaga las luces que viven en ella, para todos', () => {
    const layers = LAYERS_ALL.map(l => (l.kind === 'objects' ? { ...l, visible: false } : l));
    expect(paintedLights(all, layers, true)).toEqual([LIGHT_SECRET]);
  });
});

describe('la paleta y el alcance de las luces', () => {
  /** Son valores que se GUARDAN en la fila, así que no pueden ser variables de CSS: cambiarían con el tema. */
  it('la paleta es de colores guardables, no de tokens', () => {
    expect(LIGHT_COLORS.length).toBeGreaterThan(3);
    for (const c of LIGHT_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    // Y el color de cada tipo sale de esa misma paleta, para que no haya dos paletas.
    for (const k of LIGHT_KINDS) expect(LIGHT_COLORS).toContain(LIGHT_PRESETS[k].color as typeof LIGHT_COLORS[number]);
  });

  it('el alcance se mueve en pasos de medio metro y no se sale de madre', () => {
    expect(clampRangeM(6.3)).toBe(6.5);
    expect(clampRangeM(0)).toBe(MIN_RANGE_M);
    expect(clampRangeM(999)).toBe(MAX_RANGE_M);
  });
});

describe('el pincel de transparencia', () => {
  /**
   * Los dos sentidos son lo que hace verdad la promesa del spec: la foto original no se toca y siempre se
   * puede volver atrás. Sin `restore` el pincel sería un borrador de un solo viaje.
   */
  it('tiene dos sentidos: quitar y devolver', () => {
    expect(MASK_DIRECTIONS).toEqual(['erase', 'restore']);
  });

  it('lleva el punto de la escena a su sitio en la máscara reducida', () => {
    const size = maskSize(SCENE_WAREHOUSE); // 1080x675 → 1024x640
    expect(toMaskPoint({ x: 0, y: 0 }, SCENE_WAREHOUSE, size)).toEqual({ x: 0, y: 0 });
    const far = toMaskPoint({ x: SCENE_WAREHOUSE.width, y: SCENE_WAREHOUSE.height }, SCENE_WAREHOUSE, size);
    expect(far).toEqual({ x: size.width, y: size.height });
    // El centro sigue siendo el centro: si no, pintar en una esquina dejaría el brochazo en otra parte.
    const mid = toMaskPoint({ x: 540, y: 337.5 }, SCENE_WAREHOUSE, size);
    expect(mid.x).toBeCloseTo(size.width / 2, 5);
    expect(mid.y).toBeCloseTo(size.height / 2, 5);
  });

  it('rellena el arrastre para que el trazo no salga a lunares', () => {
    const dots = strokeDots({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(dots).toHaveLength(10);
    expect(dots.at(-1)).toEqual({ x: 100, y: 0 });
    for (let i = 1; i < dots.length; i++) expect(Math.hypot(dots[i]!.x - dots[i - 1]!.x, dots[i]!.y - dots[i - 1]!.y)).toBeCloseTo(10, 5);
  });

  it('un clic suelto también estampa, sin arrastrar nada', () => {
    expect(strokeDots({ x: 7, y: 9 }, { x: 7, y: 9 }, 10)).toEqual([{ x: 7, y: 9 }]);
  });

  it('un paso absurdo no cuelga el navegador', () => {
    expect(strokeDots({ x: 0, y: 0 }, { x: 3, y: 0 }, 0).length).toBeLessThanOrEqual(7);
  });
});
