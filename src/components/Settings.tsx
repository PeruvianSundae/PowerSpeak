import { useEffect, useState } from 'react';
import { backupFileName, exportData, importData, resetLang } from '../db/storage';
import { findVoice, getVoices, speak } from '../tts/speak';
import { LANG_INFO, LANGS, type LangCode, type LangSettings, type Settings as SettingsT, type Theme } from '../types';

interface Props {
  settings: SettingsT;
  onChange: (s: SettingsT) => void;
  onDataReplaced: () => void;
}

export default function Settings({ settings, onChange, onDataReplaced }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const [message, setMessage] = useState('');
  const [resetTarget, setResetTarget] = useState<LangCode>('pt');

  useEffect(() => {
    void getVoices().then(setVoices);
  }, []);

  const set = <K extends keyof SettingsT>(key: K, value: SettingsT[K]) => onChange({ ...settings, [key]: value });
  const setLang = (l: LangCode, patch: Partial<LangSettings>) =>
    onChange({ ...settings, langs: { ...settings.langs, [l]: { ...settings.langs[l], ...patch } } });
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  const doExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMessage(`Respaldo descargado: ${a.download}`);
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!window.confirm('Importar reemplazará TODO tu progreso actual por el del archivo. ¿Continuar?')) return;
      await importData(data);
      onDataReplaced();
      setMessage('✅ Progreso restaurado desde el respaldo.');
    } catch (e) {
      setMessage(`❌ ${e instanceof SyntaxError ? 'El archivo no es un JSON válido.' : e instanceof Error ? e.message : String(e)}`);
    }
  };

  const doReset = async () => {
    const name = LANG_INFO[resetTarget].name;
    if (!window.confirm(`¿Borrar todo el progreso de ${name}? Esta acción no se puede deshacer.`)) return;
    await resetLang(resetTarget);
    setMessage(`Progreso de ${name} reiniciado.`);
  };

  return (
    <div className="settings">
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}

      <section>
        <h2>Audio</h2>
        <label className="row">
          <span>Reproducir audio automáticamente</span>
          <input type="checkbox" checked={settings.autoplay} onChange={(e) => set('autoplay', e.target.checked)} />
        </label>
        <label className="row">
          <span>Velocidad del habla: {settings.speechRate.toFixed(1)}×</span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={settings.speechRate}
            onChange={(e) => set('speechRate', Number(e.target.value))}
          />
        </label>
        <ul className="voices">
          {LANGS.map((l) => {
            const v = voices ? findVoice(voices, LANG_INFO[l].ttsLang) : null;
            return (
              <li key={l}>
                <span>
                  {LANG_INFO[l].flag} {LANG_INFO[l].name}:{' '}
                  {voices === null ? '…' : v ? `✓ ${v.name}` : voices.length ? '⚠ sin voz instalada' : 'voz del sistema'}
                </span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    const r = speak(LANG_INFO[l].sample, LANG_INFO[l].ttsLang, settings.speechRate);
                    if (r !== 'ok')
                      setMessage(
                        r === 'sin-soporte'
                          ? 'Este navegador no tiene síntesis de voz.'
                          : `No hay voz de ${LANG_INFO[l].name.toLowerCase()}. Android: Ajustes → Texto a voz. iOS: Ajustes → Accesibilidad → Contenido leído.`,
                      );
                  }}
                >
                  Probar
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Pantalla</h2>
        <label className="row">
          <span>Furigana en japonés</span>
          <input type="checkbox" checked={settings.showFurigana} onChange={(e) => set('showFurigana', e.target.checked)} />
        </label>
        <label className="row">
          <span>Pinyin en chino</span>
          <input type="checkbox" checked={settings.showPinyin} onChange={(e) => set('showPinyin', e.target.checked)} />
        </label>
        <label className="row">
          <span>Romanización (japonés, chino, ruso)</span>
          <input
            type="checkbox"
            checked={settings.showRomanization}
            onChange={(e) => set('showRomanization', e.target.checked)}
          />
        </label>
        <label className="row">
          <span>Tema</span>
          <select value={settings.theme} onChange={(e) => set('theme', e.target.value as Theme)}>
            <option value="sistema">Según el sistema</option>
            <option value="claro">Claro</option>
            <option value="oscuro">Oscuro</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Por idioma</h2>
        {LANGS.map((l) => {
          const ls = settings.langs[l];
          return (
            <fieldset key={l} className="lang-settings">
              <legend>
                {LANG_INFO[l].flag} {LANG_INFO[l].name}
              </legend>
              <label className="row">
                <span>Nuevas por día</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={ls.newPerDay}
                  onChange={(e) => setLang(l, { newPerDay: num(e.target.value, 0, 100) })}
                />
              </label>
              <label className="row">
                <span>Máximo de repasos por día</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  value={ls.maxReviewsPerDay}
                  onChange={(e) => setLang(l, { maxReviewsPerDay: num(e.target.value, 0, 9999) })}
                />
              </label>
              <label className="row">
                <span>Modo inverso (español → {LANG_INFO[l].name.split(' ')[0].toLowerCase()})</span>
                <input type="checkbox" checked={ls.reverse} onChange={(e) => setLang(l, { reverse: e.target.checked })} />
              </label>
            </fieldset>
          );
        })}
      </section>

      <section>
        <h2>Datos</h2>
        <p className="muted small">
          Todo tu progreso vive solo en este navegador. Exporta un respaldo de vez en cuando para no perderlo.
        </p>
        <div className="buttons">
          <button type="button" className="btn" onClick={() => void doExport()}>
            ⬇️ Exportar progreso
          </button>
          <label className="btn">
            ⬆️ Importar progreso
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void doImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <div className="row">
          <select value={resetTarget} onChange={(e) => setResetTarget(e.target.value as LangCode)} aria-label="Idioma a reiniciar">
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_INFO[l].name}
              </option>
            ))}
          </select>
          <button type="button" className="btn danger" onClick={() => void doReset()}>
            Reiniciar progreso
          </button>
        </div>
      </section>
    </div>
  );
}
