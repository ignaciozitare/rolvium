import { describe, it, expect, vi } from 'vitest';
import { WebAudioWhisperSound } from './WebAudioWhisperSound';

function fakeCtx() {
  const started: number[] = [];
  const ctx = {
    state: 'running' as string,
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    createOscillator: () => ({
      type: '', frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: (t: number) => { started.push(t); },
      stop: vi.fn(),
    }),
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (n: unknown) => n,
    }),
    started,
  };
  return ctx;
}

describe('WebAudioWhisperSound', () => {
  it('suena: dos notas cortas, una detrás de otra', () => {
    const ctx = fakeCtx();
    new WebAudioWhisperSound((function () { return ctx; }) as never).play();
    expect(ctx.started).toEqual([0, 0.09]);
  });

  it('reutiliza UN contexto entre sonidos: uno por susurro agota el límite del navegador', () => {
    const ctx = fakeCtx();
    let creados = 0;
    const Ctor = function () { creados += 1; return ctx; } as never;
    const s = new WebAudioWhisperSound(Ctor);
    s.play(); s.play();
    expect(creados).toBe(1);
    expect(ctx.started).toHaveLength(4);
  });

  it('despierta un contexto dormido (el navegador los suspende solos)', () => {
    const ctx = fakeCtx();
    ctx.state = 'suspended';
    new WebAudioWhisperSound((function () { return ctx; }) as never).play();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('sin Web Audio (jsdom, o navegador que no deja sonar) no hace nada y NO revienta', () => {
    expect(() => new WebAudioWhisperSound(null).play()).not.toThrow();
  });

  it('si el navegador falla al sonar, se sigue en silencio: una excepción aquí tumbaría la mesa', () => {
    const roto = (function () { throw new Error('NotAllowedError'); }) as never;
    expect(() => new WebAudioWhisperSound(roto).play()).not.toThrow();
  });
});
