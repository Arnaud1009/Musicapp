import { useEffect, useRef } from 'react';

interface Props {
  active: boolean;
  /** Reçoit l'horodatage précis de l'événement (horloge performance.now). */
  onTap: (timeStamp: number) => void;
  label?: string;
}

/** Grande zone de frappe tactile ; la barre d'espace (ou toute touche) fonctionne aussi. */
export function TapPad({ active, onTap, label = 'Tapez ici ou sur la barre d’espace' }: Props) {
  const padRef = useRef<HTMLButtonElement>(null);

  const flash = () => {
    const el = padRef.current;
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth; // relance l'animation
    el.classList.add('flash');
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Escape') return;
      e.preventDefault();
      flash();
      onTap(e.timeStamp);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onTap]);

  return (
    <button
      ref={padRef}
      type="button"
      className={`tap-pad ${active ? 'active' : ''}`}
      disabled={!active}
      onPointerDown={(e) => {
        if (!active) return;
        e.preventDefault();
        flash();
        onTap(e.timeStamp);
      }}
    >
      {label}
    </button>
  );
}
