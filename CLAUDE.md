# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PWA (React 18 + Vite 5 + TypeScript) for pianists to practise **note reading** (treble/bass clefs, on-screen piano keyboard), **rhythm reading** (tap the displayed rhythm over a metronome) and **scale reading** (play a written scale on the keyboard, or identify it among 4 names). UI text and code comments are in French. All data is local (zustand `persist` → localStorage); there is no backend.

## Commands

```bash
npm run dev                      # dev server, http://localhost:5173
npm run dev -- --host            # expose on LAN to test on a phone
npm run build                    # tsc -b (type-check) + vite build + service worker
npm test                         # vitest run (all tests)
npx vitest run src/rhythm        # tests in one folder
npx vitest run -t "scoring"      # tests whose name matches
npx tsc -b                       # type-check only
```

There is no linter configured. `npm run build` is the type-check gate.

## Architecture

**Pure logic (no React, unit-tested in node):**
- `src/music/` — `pitch.ts` is the pitch model (`{step, alter, octave}`, `alter` from -2 to 2 for double flats/sharps, scientific octave: C4 = middle C, = MIDI 60) with conversions to MIDI, VexFlow keys (`"c#/4"`), French names. `noteLevels.ts` defines levels as clef ranges + accidentals flag; `noteGenerator.ts` expands a level into candidate questions and picks one with weights derived from per-note stats (error rate, response time).
- `src/rhythm/` — resolution is **12 ticks per quarter note** (`TPQ`) so sixteenths (3) and eighth-triplets (4) are integers. Rhythms are built from **cells** (`CELLS` in `rhythmLevels.ts`): beat-sized groups of events. A level is a weighted set of cell ids + allowed time signatures. `rhythmGenerator.ts` fills measures with cells (`canPlace` enforces placement rules, compound cells only in 6/8) and `onsets()` derives the attack times to be tapped (skips rests and tie continuations). `scoring.ts` matches taps to expected onsets in seconds; per-onset windows are capped at half the gap to neighbours so one tap can't count twice.

- `src/scales/` — `scales.ts` is the theory: keys are generated from the 15 key signatures (`keysUpTo`), minors via the relative major's 6th degree; `scaleDegrees` spells each degree by letter (so G♯ harmonic minor gets F𝄪, C♭ major gets F♭). Melodic minor descends as natural minor. Written as one measure up | one measure down; `writtenAccidentals` prints only what differs from the key signature or from an earlier accidental in the same measure and octave. `distractors` always includes the relative key (same signature) for the recognize quiz. `scaleLevels.ts` defines levels (max accidentals, types, clefs, direction) and session lengths.

**Rendering (VexFlow 4, imported from `vexflow/bravura` to keep the bundle small):**
- `Staff.tsx` draws a single whole note on a single or grand staff; vertical margins are computed from the level's ledger-line extent.
- `RhythmStaff.tsx` lays measures into rows, builds beams per cell/beat, tuplets (must be created *before* `voice.addTickables`), ties, result colouring/annotations. After drawing it records note x-positions per measure to drive the playhead cursor (animated via rAF outside React) and tap markers.
- `ScaleStaff.tsx` draws clef + key signature (VexFlow spec is always the relative major) and whole notes, one row per measure unless the screen is wide; `colors` is indexed over all notes of both measures.
- All staves render inside a `.paper` card that stays light in dark mode (VexFlow ink colours are hard-coded).

**Audio & timing (`src/audio/audioEngine.ts`):** one shared `AudioContext` (created lazily on a user gesture for iOS). Exercises schedule *all* clicks/notes upfront on the audio clock (`schedule()`), not with timers. Taps use the DOM `event.timeStamp`, converted via `eventToAudioTime()`/`audibleTime()` (based on `getOutputTimestamp`) so taps and heard clicks share one clock; the user-calibrated `latencyMs` setting is then subtracted.

**State (`src/store/`) — multi-profile:**
- `useProfiles` (localStorage key `solfege-profiles`) holds every profile; each `Profile` embeds its own `settings: ProfileSettings` (current levels, tempo, session options, keyboard labels, custom level) and `progress: ProgressData`. Mutations of the active profile go through `updateActive`.
- `useDeviceSettings` (`solfege-device`) holds what belongs to the device and is shared by all profiles: theme, sounds, `latencyMs`.
- `useSettings()` / `useProgress()` are **facade hooks** (not zustand stores) that merge device settings + active profile. `setSettings` routes each key to profile or device depending on whether it exists in `defaultProfileSettings()` — add new per-profile settings there. In event handlers use `getSettings()` / `getProgress()` (no `.getState()` on the facades).
- Scale results are stored per exercise: `scaleBest` keyed by `scaleBestKey(mode, levelId)` (`play` / `recognize`).
- `useProfiles`' persist `merge` runs `normalizeProfile` on load, filling fields added after a profile was saved (from `defaultProfileSettings()` / `emptyProgress()`), so new per-profile fields need no version migration.
- `progressLogic.ts` contains the pure update functions (`withNoteSession`, …), pass criteria `NOTE_PASS` / `RHYTHM_PASS`, and `suggested*Level`. All levels are freely selectable; "passed" only drives the ✓ badge and the "conseillé" suggestion in `LevelPicker`.
- First load migrates the old single-user keys (`solfege-settings`, `solfege-progress`) into a profile named "Moi"; the legacy keys are left in place.

**App shell:** `HashRouter` (works on any static host), bottom tab bar, PWA via `vite-plugin-pwa` (`registerType: autoUpdate`, `base: './'`). Icons in `public/` were generated from `public/favicon.svg` with `npx pwa-assets-generator --preset minimal-2023 public/favicon.svg`.

## Testing notes

- `src/music/*.test.ts`, `src/rhythm/*.test.ts` run in node.
- `src/components/render.test.tsx` uses `// @vitest-environment jsdom` and renders every note level / random rhythms through VexFlow to catch runtime errors; it stubs `ResizeObserver`, `getBoundingClientRect` and SVG `getBBox`. When adding a cell or level, this test plus the generator test ("mesures complètes") are the main safety net.
- `src/pages/pages.test.tsx` mounts the whole `App` and drives level selection, profile creation/switching and both scale exercises (stubs a fake `AudioContext`; `Math.random` is mocked to pick C major). The keyboard is wider than the 400px test viewport, so key presses there need `pointerdown` + `pointerup`; `src/store/profiles.test.ts` covers profile isolation and legacy migration (uses `vi.resetModules()` + dynamic imports so each test gets fresh stores).
- Under Node ≥ 25, Node's own `localStorage` global shadows jsdom's and is undefined; tests that touch the stores define an in-memory `localStorage` on `globalThis` at the top of the file.
