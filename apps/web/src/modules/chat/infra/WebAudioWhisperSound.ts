import type { SoundPort } from '../domain/ports/SoundPort';

type Ctor = new () => AudioContext;

/**
 * EL RUIDITO DE «ALGUIEN TE SUSURRA» (suyo, 2026-09-16: «*que se vea y un ruidito*»).
 *
 * Se sintetiza con la Web Audio API en vez de traer un mp3: no hay fichero que subir al bucket ni que esperar
 * a que se descargue la primera vez, y suena igual en todos los navegadores. Dos notas suaves y cortas, no una
 * alarma — esto interrumpe una partida.
 *
 * ⚠️ Nunca revienta. Un navegador puede negarse a sonar (jsdom no tiene `AudioContext`; una pestaña donde
 * todavía no se ha tocado nada tampoco suena por política del navegador — en la mesa siempre se ha tocado
 * algo antes). Un susurro sin ruido sigue siendo un susurro; una excepción aquí tumbaría el árbol de React.
 */
export class WebAudioWhisperSound implements SoundPort {
  private ctx: AudioContext | null = null;

  constructor(private readonly Ctor: Ctor | null = pickCtor()) {}

  play(): void {
    if (!this.Ctor) return;
    try {
      // El contexto se crea una vez y se reutiliza: uno por sonido agota el límite del navegador.
      this.ctx ??= new this.Ctor();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime;
      for (const [at, hz] of [[0, 880], [0.09, 1174.7]] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        // Entrada y salida en rampa: un seno que arranca y para en seco hace «clic».
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.06, t0 + at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.18);
      }
    } catch { /* el navegador no deja sonar: se sigue, en silencio */ }
  }
}

function pickCtor(): Ctor | null {
  const g = globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}
