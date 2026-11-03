import { useCallback, useEffect, useState } from 'react';
import LanguagePicker from './components/LanguagePicker';
import Settings from './components/Settings';
import Stats from './components/Stats';
import StudySession, { SessionEnd, type SessionSummary } from './components/StudySession';
import { defaultSettings, getSettings, saveSettings } from './db/storage';
import { getVoices } from './tts/speak';
import { LANG_INFO, type LangCode, type Settings as SettingsT } from './types';

type Screen =
  | { name: 'inicio' }
  | { name: 'estudio'; lang: LangCode }
  | { name: 'fin'; summary: SessionSummary }
  | { name: 'estadisticas' }
  | { name: 'ajustes' };

const TITLES: Record<Screen['name'], string> = {
  inicio: 'PowerSpeak',
  estudio: 'Estudio',
  fin: 'Fin de sesión',
  estadisticas: 'Estadísticas',
  ajustes: 'Ajustes',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'inicio' });
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [dbError, setDbError] = useState('');

  const loadSettings = useCallback(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {
        setDbError('No se pudo abrir el almacenamiento local (¿modo incógnito?). El progreso no se guardará.');
        setSettings(defaultSettings());
      });
  }, []);

  useEffect(() => {
    loadSettings();
    void getVoices(); // precarga las voces (Chrome las carga de forma asíncrona)
  }, [loadSettings]);

  // Tema claro/oscuro.
  useEffect(() => {
    const root = document.documentElement;
    if (!settings || settings.theme === 'sistema') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings?.theme]);

  // El botón "atrás" del celular vuelve al inicio en vez de cerrar la app.
  useEffect(() => {
    const onPop = () => setScreen({ name: 'inicio' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (next: Screen) => {
    if (screen.name === 'inicio' && next.name !== 'inicio') history.pushState(null, '');
    setScreen(next);
  };
  const home = () => {
    if (screen.name !== 'inicio') history.back();
    else setScreen({ name: 'inicio' });
  };

  const updateSettings = (s: SettingsT) => {
    setSettings(s);
    void saveSettings(s);
  };

  if (!settings) return <p className="muted center">Cargando…</p>;

  const title = screen.name === 'estudio' ? LANG_INFO[screen.lang].name : TITLES[screen.name];

  return (
    <div className="app">
      <header className="topbar">
        {screen.name !== 'inicio' ? (
          <button type="button" className="icon-btn" onClick={home} aria-label="Volver al inicio">
            ←
          </button>
        ) : (
          <span className="logo" aria-hidden="true">
            ⚡
          </span>
        )}
        <h1>{title}</h1>
        {screen.name === 'inicio' && (
          <nav className="topnav">
            <button type="button" className="icon-btn" onClick={() => go({ name: 'estadisticas' })} aria-label="Estadísticas">
              📊
            </button>
            <button type="button" className="icon-btn" onClick={() => go({ name: 'ajustes' })} aria-label="Ajustes">
              ⚙️
            </button>
          </nav>
        )}
      </header>
      {dbError && <div className="warning">{dbError}</div>}
      <main>
        {screen.name === 'inicio' && (
          <LanguagePicker settings={settings} onStudy={(lang) => go({ name: 'estudio', lang })} />
        )}
        {screen.name === 'estudio' && (
          <StudySession
            key={screen.lang}
            lang={screen.lang}
            settings={settings}
            onFinish={(summary) => setScreen({ name: 'fin', summary })}
            onExit={home}
          />
        )}
        {screen.name === 'fin' && <SessionEnd summary={screen.summary} onHome={home} />}
        {screen.name === 'estadisticas' && <Stats />}
        {screen.name === 'ajustes' && (
          <Settings settings={settings} onChange={updateSettings} onDataReplaced={loadSettings} />
        )}
      </main>
    </div>
  );
}
