/**
 * Un sonido corto de la mesa. Es un puerto y no una llamada suelta a la Web Audio API para poder callarlo en
 * los tests y cambiar a qué suena sin tocar una sola línea de la UI.
 */
export interface SoundPort {
  play(): void;
}
