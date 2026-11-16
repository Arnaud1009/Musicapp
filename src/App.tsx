import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { NoteTrainer } from './pages/NoteTrainer';
import { RhythmTrainer } from './pages/RhythmTrainer';
import { ScaleTrainer } from './pages/ScaleTrainer';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { useDeviceSettings } from './store/useDeviceSettings';

const NAV = [
  { to: '/', label: 'Accueil', icon: '⌂' },
  { to: '/notes', label: 'Notes', icon: '𝅝' },
  { to: '/rythme', label: 'Rythme', icon: '♫' },
  { to: '/gammes', label: 'Gammes', icon: '♯' },
  { to: '/stats', label: 'Progrès', icon: '▤' },
  { to: '/reglages', label: 'Réglages', icon: '⚙' },
];

export function App() {
  const theme = useDeviceSettings((s) => s.theme);
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <HashRouter>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/notes" element={<NoteTrainer />} />
          <Route path="/rythme" element={<RhythmTrainer />} />
          <Route path="/gammes" element={<ScaleTrainer />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/reglages" element={<Settings />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="tab-icon" aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </HashRouter>
  );
}
