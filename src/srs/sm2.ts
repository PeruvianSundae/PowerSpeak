// SM-2 adaptado, estilo Anki (docs/SPEC.md, sección 7). Funciones puras.
import type { Grade, LangCode, ReviewState } from '../types';

export const LEARNING_STEPS_MIN = [1, 10];
export const RELEARNING_STEPS_MIN = [10];
export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const GRADUATING_INTERVAL = 1;
export const EASY_INTERVAL = 4;
/** El "día" empieza a las 4:00 a.m. hora local. */
export const DAY_CUTOFF_HOUR = 4;

const MINUTE_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Día lógico (YYYY-MM-DD) de `now`: antes de las 4:00 a.m. cuenta como el día anterior. */
export function dayKey(now: Date, cutoffHour = DAY_CUTOFF_HOUR): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Suma días a una fecha YYYY-MM-DD (aritmética en UTC, sin efectos de horario de verano). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Días entre dos fechas YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const clampEase = (ease: number) =>
  Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, ease)) * 100) / 100;

/** Estado de una tarjeta que nunca se ha estudiado. */
export function initialState(cardId: string, lang: LangCode, now: Date): ReviewState {
  return {
    cardId,
    lang,
    reps: 0,
    lapses: 0,
    ease: INITIAL_EASE,
    interval: 0,
    due: dayKey(now),
    lastReviewed: '',
    state: 'learning',
    step: 0,
  };
}

function stepsFor(state: ReviewState): number[] {
  return state.state === 'relearning' ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;
}

/** Aplica una calificación y devuelve el nuevo estado (no modifica `prev`). */
export function review(prev: ReviewState, grade: Grade, now: Date): ReviewState {
  const today = dayKey(now);
  const base = { ...prev, lastReviewed: now.toISOString() };
  const reps = grade === 0 ? 0 : prev.reps + 1;

  const toReview = (interval: number, ease = prev.ease): ReviewState => {
    const s: ReviewState = { ...base, reps, ease, interval, due: addDays(today, interval), state: 'review' };
    delete s.step;
    return s;
  };
  const toStep = (state: 'learning' | 'relearning', step: number, extra: Partial<ReviewState> = {}): ReviewState => ({
    ...base,
    reps,
    due: today,
    state,
    step,
    ...extra,
  });

  if (prev.state === 'learning' || prev.state === 'relearning') {
    const steps = stepsFor(prev);
    const step = Math.min(prev.step ?? 0, steps.length - 1);
    const graduate = (easy: boolean) =>
      prev.state === 'learning'
        ? toReview(easy ? EASY_INTERVAL : GRADUATING_INTERVAL)
        : // Al salir de reaprendizaje se usa el intervalo reducido guardado en el fallo.
          toReview(Math.max(1, prev.interval) + (easy ? 1 : 0));
    switch (grade) {
      case 0:
        return toStep(prev.state, 0);
      case 1:
        return toStep(prev.state, step);
      case 2:
        return step + 1 >= steps.length ? graduate(false) : toStep(prev.state, step + 1);
      case 3:
        return graduate(true);
    }
  }

  // Tarjeta en repaso.
  const ivl = Math.max(1, prev.interval);
  switch (grade) {
    case 0:
      return toStep('relearning', 0, {
        lapses: prev.lapses + 1,
        ease: clampEase(prev.ease - 0.2),
        interval: Math.max(1, Math.round(ivl * 0.5)),
      });
    case 1:
      return toReview(Math.max(ivl + 1, Math.round(ivl * 1.2)), clampEase(prev.ease - 0.15));
    case 2:
      return toReview(Math.max(ivl + 1, Math.round(ivl * prev.ease)));
    case 3: {
      const ease = clampEase(prev.ease + 0.15);
      return toReview(Math.max(ivl + 1, Math.round(ivl * ease * 1.3)), ease);
    }
  }
}

/** Momento (ms) en que vence una tarjeta en aprendizaje/reaprendizaje; null si está en repaso. */
export function learningDueAt(state: ReviewState): number | null {
  if (state.state === 'review') return null;
  const steps = stepsFor(state);
  const minutes = steps[Math.min(state.step ?? 0, steps.length - 1)];
  const last = state.lastReviewed ? Date.parse(state.lastReviewed) : 0;
  return last + minutes * MINUTE_MS;
}

/** Texto en español del próximo intervalo: "1 min", "10 min", "1 día", "3 meses", "1,5 años". */
export function formatInterval(next: ReviewState): string {
  if (next.state !== 'review') {
    const steps = stepsFor(next);
    return `${steps[Math.min(next.step ?? 0, steps.length - 1)]} min`;
  }
  const d = next.interval;
  if (d < 30) return d === 1 ? '1 día' : `${d} días`;
  if (d < 365) {
    const m = Math.round(d / 30);
    return m === 1 ? '1 mes' : `${m} meses`;
  }
  const y = Math.round((d / 365) * 10) / 10;
  return `${String(y).replace('.', ',')} ${y === 1 ? 'año' : 'años'}`;
}

/** Intervalo previsto para cada botón (Otra vez, Difícil, Bien, Fácil). */
export function previewIntervals(prev: ReviewState, now: Date): [string, string, string, string] {
  return ([0, 1, 2, 3] as Grade[]).map((g) => formatInterval(review(prev, g, now))) as [
    string,
    string,
    string,
    string,
  ];
}
