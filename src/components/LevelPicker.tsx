import { useEffect, useRef, useState } from 'react';

export interface LevelOption {
  id: string;
  /** Libellé court affiché avant le titre ("1", "2"… ou "★"). */
  badge: string;
  title: string;
  description: string;
  /** Meilleur résultat, ex. "92 %" ou "88". */
  best?: string;
  passed?: boolean;
}

interface Props {
  options: LevelOption[];
  value: string;
  onChange: (id: string) => void;
  suggestedId?: string;
  disabled?: boolean;
}

/** Sélecteur de niveau : tous les niveaux sont accessibles, avec leur état de progression. */
export function LevelPicker({ options, value, onChange, suggestedId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="level-picker" ref={rootRef}>
      <button
        type="button"
        className="level-current"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="level-badge">{current.badge}</span>
        <span className="level-current-title">{current.title}</span>
        {current.passed && <span className="level-check" aria-label="réussi">✓</span>}
        <span className="chevron" aria-hidden>▾</span>
      </button>
      {open && (
        <ul className="level-list" role="listbox" aria-label="Choisir un niveau">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`level-option ${o.id === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                <span className={`level-badge ${o.passed ? 'passed' : ''}`}>{o.passed ? '✓' : o.badge}</span>
                <span className="level-text">
                  <span className="level-title">
                    {o.title}
                    {o.id === suggestedId && !o.passed && <span className="tag">conseillé</span>}
                  </span>
                  <span className="level-desc">{o.description}</span>
                </span>
                {o.best && <span className="level-best">{o.best}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
