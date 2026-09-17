import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Lo que se pinta EN EL HUECO de lo que se ha caído. Recibe `reintentar`, que vuelve a montar el trozo
   * desde cero, y el error, por si quien llama quiere decir algo distinto según lo que se rompió.
   *
   * Es una función y no un nodo a propósito: `@rolvium/ui` no sabe de traducciones —igual que `Sheet`, que
   * recibe su `t`—, así que los textos los pone quien la usa.
   */
  fallback: (reintentar: () => void, error: Error) => ReactNode;
  /** Qué trozo es. Sale en la consola para saber cuál se cayó sin tener que adivinarlo. */
  label?: string;
  /** Para enganchar aquí un servicio de vigilancia el día que se quiera. Hoy no hay ninguno. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State { error: Error | null }

/**
 * LA RED: un error AL PINTARSE se queda dentro de este trozo en vez de llevarse la pantalla entera.
 *
 * 🐞 Por qué existe (2026-09-17, orden suya: «*cualquier error al pintar te tumba la mesa entera en vez de
 * estropear un trozo*»). Lo destapó el fallo de los trazos (v0.12.2): un eco de tiempo real llegaba sin la
 * columna del dibujo, `DrawingShape` leía `data.points` sobre nada y lanzaba durante el pintado. Como no
 * había NI UNA red en todo `apps/web`, React desmonta el árbol entero ante un error de render no capturado:
 * la mesa se quedaba en blanco con la partida en marcha y la base de datos intacta.
 *
 * ⚠️ NO ATRAPA TODO, y no debe venderse como que sí. Una red de React coge lo que lanza **al pintarse** (y en
 * los ciclos de vida). **NO** coge lo que falla dentro de un manejador de eventos, ni en una promesa o un
 * `async`, ni en el servidor. Esos caminos siguen necesitando su propio manejo de errores.
 *
 * 🔑 Y no es excusa para dejar de arreglar la causa: un trozo caído es un fallo, no un estado aceptable. La
 * red sólo compra que no se pierda la partida mientras tanto. Ver `specs/core/errors/SPEC.md`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Queda escrito para poder diagnosticarlo: sin esto, un trozo caído es un misterio silencioso.
    // eslint-disable-next-line no-console
    console.error(`[Rolvium] se ha roto al pintar${this.props.label ? `: ${this.props.label}` : ''}`, error, info.componentStack);
    this.props.onError?.(error, info);
  }

  /** Vuelve a montar el trozo desde cero. Si el dato malo sigue ahí, se volverá a caer — y eso está bien. */
  private readonly reintentar = (): void => { this.setState({ error: null }); };

  override render(): ReactNode {
    const { error } = this.state;
    return error ? this.props.fallback(this.reintentar, error) : this.props.children;
  }
}
