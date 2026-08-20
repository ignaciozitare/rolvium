import { ACCEPTED_MIME } from './compressImage';

/**
 * Abre el selector de ficheros del navegador y devuelve la imagen elegida, o `null` si el usuario canceló.
 *
 * Existe como utilidad y no como componente porque quien la necesita ya tiene su propio botón dibujado
 * —la ficha de personaje lo trae del esquema del sistema— y sólo le falta el paso de elegir fichero.
 *
 * `cancel` no se puede detectar en todos los navegadores, así que el `<input>` se queda en el DOM hasta
 * que hay `change` o el usuario vuelve a la pestaña. Se limpia siempre, pase lo que pase.
 */
export function pickImageFile(accept: readonly string[] = ACCEPTED_MIME): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept.join(',');
    input.style.display = 'none';

    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      window.removeEventListener('focus', onFocus);
      resolve(file);
    };
    // Si el usuario cancela, muchos navegadores no disparan nada: al volver el foco a la ventana se da
    // por cancelado. El retardo evita adelantarse al `change`, que llega justo después del foco.
    const onFocus = () => setTimeout(() => { if (!input.files?.length) finish(null); }, 400);

    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}
