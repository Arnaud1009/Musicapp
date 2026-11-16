import { useEffect, useRef, useState } from 'react';
import { type Profile, useActiveProfile, useProfiles } from '../store/useProfiles';

export function Avatar({ profile, size = 28 }: { profile: Pick<Profile, 'name' | 'color'>; size?: number }) {
  return (
    <span className="avatar" style={{ background: profile.color, width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {profile.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function NewProfileForm({ onDone }: { onDone: () => void }) {
  const createProfile = useProfiles((s) => s.createProfile);
  const [name, setName] = useState('');
  return (
    <form
      className="new-profile"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        createProfile(name);
        setName('');
        onDone();
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={30}
        placeholder="Prénom"
        aria-label="Nom du nouveau profil"
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="primary" disabled={!name.trim()}>
        Créer
      </button>
    </form>
  );
}

/** Pastille du profil actif ; un appui ouvre la liste pour changer d'élève. */
export function ProfileSwitcher() {
  const { profiles, switchProfile } = useProfiles();
  const active = useActiveProfile();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="profile-switcher" ref={rootRef}>
      <button type="button" className="profile-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar profile={active} />
        <span>{active.name}</span>
        <span className="chevron" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="profile-menu">
          <ul>
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`profile-row ${p.id === active.id ? 'selected' : ''}`}
                  onClick={() => {
                    switchProfile(p.id);
                    setOpen(false);
                  }}
                >
                  <Avatar profile={p} />
                  <span>{p.name}</span>
                  {p.id === active.id && <span className="level-check">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <NewProfileForm onDone={() => setOpen(false)} />
          ) : (
            <button type="button" className="profile-add" onClick={() => setAdding(true)}>
              ＋ Nouveau profil
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Gestion complète (Réglages) : renommer, supprimer, ajouter. */
export function ProfileManager() {
  const { profiles, activeId, switchProfile, renameProfile, deleteProfile } = useProfiles();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="profile-manager">
      <ul>
        {profiles.map((p) => (
          <li key={p.id} className="profile-item">
            <Avatar profile={p} size={32} />
            {editing === p.id ? (
              <form
                className="rename"
                onSubmit={(e) => {
                  e.preventDefault();
                  renameProfile(p.id, draft);
                  setEditing(null);
                }}
              >
                <input autoFocus value={draft} maxLength={30} onChange={(e) => setDraft(e.target.value)} aria-label="Nouveau nom" />
                <button type="submit" className="primary">OK</button>
                <button type="button" onClick={() => setEditing(null)}>Annuler</button>
              </form>
            ) : confirmDelete === p.id ? (
              <div className="confirm">
                <span>Supprimer « {p.name} » et toute sa progression ?</span>
                <button
                  className="danger"
                  onClick={() => {
                    deleteProfile(p.id);
                    setConfirmDelete(null);
                  }}
                >
                  Supprimer
                </button>
                <button onClick={() => setConfirmDelete(null)}>Annuler</button>
              </div>
            ) : (
              <>
                <span className="profile-name">
                  {p.name}
                  {p.id === activeId && <span className="tag">actif</span>}
                </span>
                <span className="profile-actions">
                  {p.id !== activeId && <button onClick={() => switchProfile(p.id)}>Utiliser</button>}
                  <button
                    onClick={() => {
                      setEditing(p.id);
                      setDraft(p.name);
                    }}
                    aria-label={`Renommer ${p.name}`}
                  >
                    Renommer
                  </button>
                  {profiles.length > 1 && (
                    <button onClick={() => setConfirmDelete(p.id)} aria-label={`Supprimer ${p.name}`}>
                      Supprimer
                    </button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <NewProfileForm onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}>＋ Nouveau profil</button>
      )}
    </div>
  );
}
