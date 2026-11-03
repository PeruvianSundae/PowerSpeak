// Audio con la Web Speech API (speechSynthesis): voz del navegador por idioma.
import { LANG_INFO, type LangCode } from '../types';

export type SpeakResult = 'ok' | 'sin-voz' | 'sin-soporte';

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Lista de voces; en Chrome se cargan de forma asíncrona. */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesPromise ??= new Promise((resolve) => {
    const done = () => {
      voicesPromise = null;
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2000);
  });
  return voicesPromise;
}

const norm = (l: string) => l.replace('_', '-').toLowerCase();

/** Mejor voz para `ttsLang` (p. ej. "pt-BR"); prefiere voces locales (funcionan offline). */
export function findVoice(voices: SpeechSynthesisVoice[], ttsLang: string): SpeechSynthesisVoice | null {
  const target = norm(ttsLang);
  const base = target.split('-')[0];
  const pick = (list: SpeechSynthesisVoice[]) => list.find((v) => v.localService) ?? list[0] ?? null;
  const exact = voices.filter((v) => norm(v.lang) === target);
  if (exact.length) return pick(exact);
  // Misma lengua, otra variante (evita cantonés para chino mandarín).
  return pick(
    voices.filter((v) => {
      const l = norm(v.lang);
      return l.split('-')[0] === base && !(base === 'zh' && /hk|yue/.test(l));
    }),
  );
}

/** Lee `text` en voz alta. Síncrono para no perder el gesto del usuario (iOS). */
export function speak(text: string, ttsLang: string, rate = 1): SpeakResult {
  if (!ttsSupported()) return 'sin-soporte';
  const voices = speechSynthesis.getVoices();
  const voice = findVoice(voices, ttsLang);
  // Si la lista está vacía (algunos navegadores no la exponen), se intenta igual con `lang`.
  if (voices.length > 0 && !voice) return 'sin-voz';
  speechSynthesis.cancel();
  // Quita el acento tónico (U+0301) del ruso para que la voz no lo lea como símbolo.
  const u = new SpeechSynthesisUtterance(text.replace(/́/g, ''));
  u.lang = voice?.lang ?? ttsLang;
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
  return 'ok';
}

export function voiceWarning(lang: LangCode, result: SpeakResult): string {
  if (result === 'sin-soporte') return 'Este navegador no tiene síntesis de voz. Prueba con Chrome o Safari.';
  return (
    `No hay una voz de ${LANG_INFO[lang].name.toLowerCase()} instalada en este dispositivo. ` +
    'Android: Ajustes → Texto a voz (motor de Google) → instala el idioma. ' +
    'iOS: Ajustes → Accesibilidad → Contenido leído → Voces.'
  );
}
