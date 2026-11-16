import { type Alter, type Step, STEPS, frenchName } from '../music/pitch';

export type NameMark = 'correct' | 'wrong';

export const nameKey = (step: Step, alter: Alter) => `${step}${alter}`;

interface Props {
  /** Affiche aussi les dièses et bémols (niveaux avec altérations). */
  accidentals: boolean;
  onPress: (step: Step, alter: Alter) => void;
  marks?: Record<string, NameMark>;
  disabled?: boolean;
}

/** Mêmes exclusions que le générateur : pas de Mi♯, Si♯, Fa♭, Do♭. */
function exists(step: Step, alter: Alter): boolean {
  if (alter === 1) return step !== 'E' && step !== 'B';
  if (alter === -1) return step !== 'F' && step !== 'C';
  return true;
}

/**
 * Réponse par le nom de la note (sans octave). Avec altérations, chaque colonne
 * empile ♯ / naturel / ♭ pour répondre d'un seul geste.
 */
export function NoteNameButtons({ accidentals, onPress, marks = {}, disabled }: Props) {
  const rows: Alter[] = accidentals ? [1, 0, -1] : [0];
  return (
    <div className={`name-buttons ${accidentals ? 'with-accidentals' : ''}`} role="group" aria-label="Nom de la note">
      {rows.map((alter) =>
        STEPS.map((step) =>
          exists(step, alter) ? (
            <button
              key={nameKey(step, alter)}
              type="button"
              className={`name-button ${alter === 0 ? 'natural' : 'altered'} ${marks[nameKey(step, alter)] ?? ''}`}
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!disabled) onPress(step, alter);
              }}
              // Activation au clavier (Entrée / Espace) : pas de pointerdown.
              onClick={(e) => {
                if (e.detail === 0 && !disabled) onPress(step, alter);
              }}
            >
              {frenchName({ step, alter })}
            </button>
          ) : (
            <span key={nameKey(step, alter)} aria-hidden />
          ),
        ),
      )}
    </div>
  );
}
