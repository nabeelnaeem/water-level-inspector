import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { PumpControl } from './pages/PumpControl';
import { ThemeToggle } from './components/ThemeToggle';
import { ConnectionDot } from './components/ConnectionDot';
import { useLiveUpdates } from './api/hooks';

export default function App() {
  const [connected, setConnected] = useState(false);
  useLiveUpdates(setConnected);

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <span className="brand">💧 Water Level Inspector</span>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              Dashboard
            </NavLink>
            <NavLink to="/pump" className={({ isActive }) => (isActive ? 'active' : '')}>
              Pump
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
              Settings
            </NavLink>
          </nav>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ConnectionDot connected={connected} />
            <ThemeToggle />
          </span>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pump" element={<PumpControl />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </>
  );
}
