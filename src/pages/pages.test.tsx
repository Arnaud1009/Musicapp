// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  },
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb([{ contentRect: { width: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.getBoundingClientRect = () => ({ width: 400, height: 100 }) as DOMRect;
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
  // Faux AudioContext : chaque nœud accepte toutes les méthodes (connect renvoie le nœud cible).
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (): Record<string, unknown> => ({
    gain: param(),
    frequency: param(),
    connect: (dest: unknown) => dest,
    disconnect() {},
    start() {},
    stop() {},
  });
  (window as unknown as { AudioContext: unknown }).AudioContext = class {
    state = 'running';
    currentTime = 0;
    destination = node();
    createOscillator = node;
    createGain = node;
    createBiquadFilter = node;
    createBufferSource = node;
    createBuffer() {
      return {};
    }
    resume() {
      return Promise.resolve();
    }
  };
  window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
});

const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('élément introuvable');
  act(() => (el as HTMLElement).click());
};
const byText = (root: ParentNode, selector: string, text: string) =>
  [...root.querySelectorAll(selector)].find((e) => e.textContent?.includes(text));

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    await new Promise((r) => setTimeout(r, 20));
  });
}

describe('application', () => {
  it('parcourt les pages, choisit un niveau et gère les profils', async () => {
    const { App } = await import('../App');
    const { getSettings } = await import('../store/useSettings');
    const { useProfiles } = await import('../store/useProfiles');
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => createRoot(container).render(<App />));

    // Accueil : profil par défaut.
    expect(container.textContent).toContain('Moi');

    // Notes : choisir le niveau 5 directement, sans avoir réussi les précédents.
    await go('#/notes');
    click(container.querySelector('.level-current'));
    expect(container.querySelectorAll('.level-option')).toHaveLength(9);
    click(byText(container, '.level-option', 'Grand-portée'));
    expect(getSettings().noteLevelId).toBe('n5');
    expect(container.querySelector('.level-current')?.textContent).toContain('Grand-portée');

    // Rythme : choisir le niveau 6.
    await go('#/rythme');
    click(container.querySelector('.level-current'));
    click(byText(container, '.level-option', 'Syncopes'));
    expect(getSettings().rhythmLevelId).toBe('r6');
    expect(container.querySelectorAll('.rhythm-staff svg').length).toBe(1);

    // Nouveau profil depuis l'accueil : il repart du niveau 1.
    await go('#/');
    click(container.querySelector('.profile-chip'));
    click(byText(container, '.profile-add', 'Nouveau profil'));
    const input = container.querySelector<HTMLInputElement>('.new-profile input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Léa');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
    expect(useProfiles.getState().profiles.map((p) => p.name)).toEqual(['Moi', 'Léa']);
    expect(container.querySelector('.profile-chip')?.textContent).toContain('Léa');
    expect(getSettings().noteLevelId).toBe('n1');
    expect(container.textContent).toContain('Niveau en cours : 1. Premiers pas');

    // Retour au premier profil : ses niveaux sont conservés.
    click(container.querySelector('.profile-chip'));
    click(byText(container, '.profile-row', 'Moi'));
    expect(getSettings().noteLevelId).toBe('n5');
    expect(getSettings().rhythmLevelId).toBe('r6');

    // Stats et Réglages se rendent.
    await go('#/stats');
    expect(container.textContent).toContain('Progrès de Moi');
    await go('#/reglages');
    expect(container.querySelectorAll('.profile-item')).toHaveLength(2);
  });

  it('gammes : joue Do majeur au clavier puis la reconnaît', async () => {
    // Math.random = 0 → première tonalité du niveau 1 (Do majeur), clé de sol.
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { App } = await import('../App');
    await act(async () => createRoot(container).render(<App />));
    await go('#/gammes');
    // Affiche les repères pour retrouver le Do central dans le test.
    const { setSettings } = await import('../store/useSettings');
    await act(async () => setSettings({ keyLabels: 'c' }));

    click(byText(container, '.segmented button', 'Jouer'));
    click(byText(container, 'button', 'Commencer'));
    expect(container.querySelectorAll('.scale-staff .vf-stavenote')).toHaveLength(8);

    // Touches blanches à partir du Do central (repéré par sa pastille).
    const whites = [...container.querySelectorAll<HTMLElement>('.key.white')];
    const c4 = whites.findIndex((k) => k.querySelector('.middle-c'));
    const press = (el: HTMLElement) =>
      act(() => {
        // Clavier défilant à cette largeur : la touche est validée au relâchement.
        el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      });
    press(whites[c4 + 1]); // erreur volontaire (Ré au lieu de Do)
    expect(container.querySelector('.feedback')?.textContent).toContain('réessayez');
    for (let i = 0; i < 8; i++) press(whites[c4 + i]);
    expect(container.querySelector('.feedback')?.textContent).toContain('Do majeur ✓ — 7/8');

    click(byText(container, '.segmented button', 'Reconnaître'));
    click(byText(container, 'button', 'Commencer'));
    expect(container.querySelectorAll('.choice')).toHaveLength(4);
    click(byText(container, '.choice', 'Do majeur'));
    expect(container.querySelector('.choice.ok')?.textContent).toBe('Do majeur');
    rand.mockRestore();
  });

  it('notes : répond avec les boutons de noms', async () => {
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { App } = await import('../App');
    const { setSettings, getSettings } = await import('../store/useSettings');
    await act(async () => setSettings({ noteLevelId: 'n1' }));
    await act(async () => createRoot(container).render(<App />));
    await go('#/notes');

    click(byText(container, '.segmented button', 'Noms'));
    expect(getSettings().noteInput).toBe('names');
    expect(container.querySelector('.keyboard')).toBeNull();
    expect(container.querySelectorAll('.name-button')).toHaveLength(7);

    click(byText(container, 'button', 'Commencer'));
    const press = (label: string) =>
      act(() => {
        byText(container, '.name-button', label)!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
    // Math.random = 0 → première note du niveau : Do4, puis Ré4 (pas de répétition).
    press('Do');
    expect(container.querySelector('.feedback')?.textContent).toBe('Do ✓');
    await act(async () => new Promise((r) => setTimeout(r, 400)));
    press('Mi');
    expect(container.querySelector('.feedback')?.textContent).toBe('C’était Ré (vous avez répondu Mi)');
    expect(byText(container, '.name-button.correct', 'Ré')).toBeDefined();
    expect(byText(container, '.name-button.wrong', 'Mi')).toBeDefined();

    // Niveau avec altérations : ♯ / naturel / ♭ par note, sans Mi♯ Si♯ Fa♭ Do♭.
    click(byText(container, '.segmented button', 'Les deux'));
    await act(async () => setSettings({ noteLevelId: 'n6' }));
    expect(container.querySelectorAll('.name-button')).toHaveLength(17);
    expect(container.querySelector('.keyboard')).not.toBeNull();
    rand.mockRestore();
  });
});
