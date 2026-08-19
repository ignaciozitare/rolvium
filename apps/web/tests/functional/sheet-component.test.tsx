import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet, PhaseDisc } from '@rolvium/ui';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { KAREN_DATA } from '../helpers/fakes';

const ts = sysT(plenilunio, 'es');
const labels = { roll: 'Tirar', add: 'Añadir', remove: 'Quitar', manual: 'Manual', of: 'de' };
const refText = (k: string) => { const r = plenilunio.references[k]; return r ? { page: r.page, title: ts(r.title), summary: ts(r.summary) } : null; };

function mount(over: Partial<Parameters<typeof Sheet>[0]> = {}) {
  const onChange = vi.fn(); const onAction = vi.fn();
  render(<Sheet schema={plenilunio.sheetSchema} data={KAREN_DATA} derived={plenilunio.engine.derived(KAREN_DATA)} onChange={onChange} onAction={onAction}
    actions={plenilunio.engine.actions ?? []} catalogs={plenilunio.catalogs} t={ts} refText={refText} labels={labels} icons={plenilunio.theme.icons ?? {}} poolSize={() => 6} {...over} />);
  return { onChange, onAction };
}

describe('<Sheet> — schema-driven, every field type', () => {
  it('renders every section from the schema with system text and tooltips «Manual · p.XX»', () => {
    mount();
    for (const s of plenilunio.sheetSchema.sections) expect(screen.getByRole('region', { name: ts(s.label) })).toBeInTheDocument();
    expect(screen.getByLabelText('Personaje')).toHaveValue('Karen «K»');
    // stat row: label + specialty + value + TIRAR n
    const stat = document.querySelector('[data-stat="combat"]')!;
    expect(within(stat as HTMLElement).getByText('Combate')).toBeInTheDocument();
    expect(within(stat as HTMLElement).getAllByRole('combobox')[0]).toHaveValue('combat.improvisedWeapons');
    expect(within(stat as HTMLElement).getByRole('button', { name: 'Tirar 6' })).toBeInTheDocument();
    // tooltip from references
    const tips = screen.getAllByRole('tooltip');
    expect(tips.some(t => t.textContent?.includes('Manual · p.20'))).toBe(true);
    // derived read-only values (endurance = 4+3 = 7, resistance max 21)
    expect(screen.getByRole('region', { name: 'Estado' })).toHaveTextContent('7');
    expect(screen.getByText('21 de 21')).toBeInTheDocument();
    // health discs
    expect(screen.getByRole('radio', { name: 'Sano' })).toHaveAttribute('aria-checked', 'true');
    // weapons table with catalog-derived cells and attack icon buttons
    const table = screen.getByRole('table', { name: 'Armas' });
    expect(within(table).getAllByRole('combobox')[0]).toHaveValue('bat');
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('7'); // magnum damage from the catalog
    // Cada arma ofrece SÓLO su acción (p.96–97): el bate es cuerpo a cuerpo y el magnum a distancia.
    // Antes se pintaban las dos en todas las filas y unas Nudilleras ofrecían «Disparar».
    expect(within(table).getAllByRole('button', { name: /Atacar cuerpo a cuerpo/ }).length).toBe(1);
    expect(within(table).getAllByRole('button', { name: /Disparar/ }).length).toBe(1);
    // Y el cargador sólo lo llevan las de fuego: el libro pone «-» en las nueve de cuerpo a cuerpo.
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('—');
    // gifts with ⚡ (bolt) and cost text
    expect(screen.getByRole('button', { name: /Activar don · Furia de titán/ })).toBeInTheDocument();
    expect(screen.getByText('1 Fortuna')).toBeInTheDocument();
    // section ref hint for weapons
    expect(screen.getByText(/Armas · Manual · p.97/)).toBeInTheDocument();
  });

  it('edits emit patches: text, select, counter, boxes, health, list add/remove, table add', async () => {
    const u = userEvent.setup();
    const { onChange } = mount();
    await u.type(screen.getByLabelText('Concepto'), '!');
    expect(onChange).toHaveBeenLastCalledWith({ concept: 'Líder de banda!' });
    await u.selectOptions(within(screen.getByRole('region', { name: 'Armadura' })).getByRole('combobox'), 'furs');
    expect(onChange).toHaveBeenLastCalledWith({ armour: 'furs' });
    await u.click(screen.getByRole('button', { name: '+ Destino' }));
    expect(onChange).toHaveBeenLastCalledWith({ destiny: 3 });
    // Manual p.25: las casillas EN BLANCO son la Resistencia que te queda y las marcadas el daño, no al
    // revés. Pulsar la décima casilla son 10 de daño, así que la Resistencia baja a 21 − 10 = 11.
    await u.click(screen.getByRole('button', { name: 'Resistencia 10' }));
    expect(onChange).toHaveBeenLastCalledWith({ resistance: 11 });

    await u.click(screen.getByRole('radio', { name: 'Herido' }));
    expect(onChange).toHaveBeenLastCalledWith({ health: 'wounded' });
    await u.click(screen.getByRole('button', { name: '+ Añadir · Dones' }));
    const gifts = onChange.mock.calls.at(-1)![0].gifts as unknown[];
    expect(gifts).toHaveLength(2);
    await u.click(screen.getByRole('button', { name: 'Quitar · Furia de titán' }));
    expect(onChange).toHaveBeenLastCalledWith({ gifts: [] });
    await u.click(screen.getByRole('button', { name: '+ Añadir · Armas' }));
    expect((onChange.mock.calls.at(-1)![0].weapons as unknown[]).length).toBe(3);
    // stat +1 and specialty add
    await u.click(screen.getByRole('button', { name: '+ Combate' }));
    expect(onChange).toHaveBeenLastCalledWith({ combat: { value: 5, specialties: ['combat.improvisedWeapons'] } });
    await u.selectOptions(screen.getByLabelText('Añadir Especialidad · Combate'), 'combat.knives');
    expect(onChange).toHaveBeenLastCalledWith({ combat: { value: 4, specialties: ['combat.improvisedWeapons', 'combat.knives'] } });
  });

  /**
   * La Resistencia va al revés de como estaba (manual p.25): en blanco lo que te queda, marcadas las
   * que te han tachado. Se prueba con una ficha YA dañada, que es la única forma de ver de qué lado
   * se pinta y de comprobar que la última marcada se puede devolver — un clic de más tiene que
   * deshacerse, si no el jugador se queda con daño que no recibió.
   */
  it('Resistencia: en blanco lo que queda, marcado el daño, y la última se devuelve (p.25)', async () => {
    const u = userEvent.setup();
    const herida = { ...KAREN_DATA, resistance: 11 };
    const { onChange } = mount({ data: herida, derived: plenilunio.engine.derived(herida) });
    const box = (n: number) => screen.getByRole('button', { name: `Resistencia ${n}` });
    // resistanceMax 21 y quedan 11 → 10 tachadas, y van por delante
    expect(box(1)).toHaveAttribute('aria-pressed', 'true');
    expect(box(10)).toHaveAttribute('aria-pressed', 'true');
    expect(box(11)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('11 de 21')).toBeInTheDocument();
    // pulsar la última tachada la devuelve: 9 de daño → 12 de Resistencia
    await u.click(box(10));
    expect(onChange).toHaveBeenLastCalledWith({ resistance: 12 });
    // y pulsar una en blanco tacha hasta ahí: 15 de daño → 6 de Resistencia
    await u.click(box(15));
    expect(onChange).toHaveBeenLastCalledWith({ resistance: 6 });
  });

  /**
   * Bordes de las casillas. El que de verdad mordía: una ficha guardada con Resistencia POR ENCIMA
   * del máximo —basta bajar Fortaleza o Voluntad después de guardarla sana, y nada la capa porque se
   * capa la subida y nunca la bajada— pintaba `val` casillas pero contaba los clics contra `max`, así
   * que las casillas de más daban Resistencia NEGATIVA y la primera tiraba 25 → 20 de un solo clic.
   * Cada casilla vale un punto y el suelo es 0, igual que `engine.applyDamage`.
   */
  it('Resistencia: sin daño, con daño máximo, y con la Resistencia por encima del máximo', async () => {
    const u = userEvent.setup();
    const box = (n: number) => screen.getByRole('button', { name: `Resistencia ${n}` });

    // sana (21 de 21): ninguna marcada, y la primera casilla es 1 de daño
    const sana = mount();
    expect(box(1)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('21 de 21')).toBeInTheDocument();
    await u.click(box(1));
    expect(sana.onChange).toHaveBeenLastCalledWith({ resistance: 20 });
    cleanup();

    // al límite (0 de 21): todas marcadas y la última se devuelve, no se pasa de rosca
    const rota = { ...KAREN_DATA, resistance: 0 };
    const alLimite = mount({ data: rota, derived: plenilunio.engine.derived(rota) });
    expect(box(21)).toHaveAttribute('aria-pressed', 'true');
    await u.click(box(21));
    expect(alLimite.onChange).toHaveBeenLastCalledWith({ resistance: 1 });
    cleanup();

    // por encima del máximo (25 de 21): 25 casillas, ninguna marcada, y NINGÚN clic baja de 0
    const sobrada = { ...KAREN_DATA, resistance: 25 };
    const over = mount({ data: sobrada, derived: plenilunio.engine.derived(sobrada) });
    expect(screen.getByText('25 de 21')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Resistencia \d+$/ })).toHaveLength(25);
    expect(box(25)).toHaveAttribute('aria-pressed', 'false');
    await u.click(box(1));
    expect(over.onChange).toHaveBeenLastCalledWith({ resistance: 24 }); // un punto, no cinco
    await u.click(box(22));
    expect(over.onChange).toHaveBeenLastCalledWith({ resistance: 3 });  // antes: −1
    await u.click(box(25));
    expect(over.onChange).toHaveBeenLastCalledWith({ resistance: 0 });  // antes: −4
  });
  it('actions: TIRAR → onAction("roll", stat); weapon icon → attack action; gift ⚡ → gift.activate', async () => {
    const u = userEvent.setup();
    const { onAction } = mount();
    await u.click(within(document.querySelector('[data-stat="presence"]') as HTMLElement).getByRole('button', { name: /Tirar/ }));
    expect(onAction).toHaveBeenCalledWith('roll', 'presence');
    await u.click(screen.getByRole('button', { name: /Disparar · Revólver magnum .44/ }));
    expect(onAction).toHaveBeenCalledWith('attack.ranged', 'magnum44');
    await u.click(screen.getByRole('button', { name: /Activar don · Furia de titán/ }));
    expect(onAction).toHaveBeenCalledWith('gift.activate', 'titanFury');
  });

  it('readOnly disables inputs and hides add/remove but keeps roll buttons; showActions=false hides them; canChange vetoes', async () => {
    const u = userEvent.setup();
    const { onChange } = mount({ readOnly: true });
    expect(screen.getByLabelText('Personaje')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Añadir/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Tirar/ }).length).toBe(7);
    document.body.innerHTML = '';
    mount({ showActions: false, canChange: (id) => id !== 'destiny' });
    expect(screen.queryByRole('button', { name: /Tirar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Destino' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: '+ Fortuna' }));
    expect(onChange).not.toHaveBeenCalled(); // first mount's spy; second mount has its own
  });

  it('fields=[…] renders only those fields (generator steps) and PhaseDisc covers 0/½/1', () => {
    mount({ fields: ['name', 'concept'] });
    expect(screen.getByLabelText('Personaje')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Estado' })).not.toBeInTheDocument();
    const { container } = render(<><PhaseDisc fraction={0} /><PhaseDisc fraction={0.5} /><PhaseDisc fraction={1} /><PhaseDisc fraction={0.25} /><PhaseDisc fraction={0.75} /></>);
    expect(container.querySelectorAll('svg path').length).toBe(4);
  });
});
