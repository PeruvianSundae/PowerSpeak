import { describe, expect, it } from 'vitest';
import {
  addDays,
  clampEase,
  dayKey,
  formatInterval,
  initialState,
  learningDueAt,
  previewIntervals,
  review,
} from '../src/srs/sm2';
import type { Grade, ReviewState } from '../src/types';

// Fechas en hora local (Date con componentes) para que el corte de las 4:00 no dependa del huso.
const at = (h: number, min = 0, day = 3) => new Date(2026, 10, day, h, min);
const NOW = at(10);
const fresh = () => initialState('ja-0001', 'ja', NOW);
const reviewCard = (over: Partial<ReviewState> = {}): ReviewState => ({
  ...fresh(),
  state: 'review',
  step: undefined,
  interval: 10,
  ease: 2.5,
  reps: 3,
  due: '2026-11-03',
  lastReviewed: at(9, 0, 1).toISOString(),
  ...over,
});
const run = (s: ReviewState, grades: Grade[], now = NOW) => grades.reduce((acc, g) => review(acc, g, now), s);

describe('dayKey (corte a las 4:00 a.m.)', () => {
  it('antes de las 4:00 cuenta como el día anterior', () => {
    expect(dayKey(at(3, 59))).toBe('2026-11-02');
    expect(dayKey(at(0, 0))).toBe('2026-11-02');
  });
  it('desde las 4:00 es el día actual', () => {
    expect(dayKey(at(4, 0))).toBe('2026-11-03');
    expect(dayKey(at(23, 59))).toBe('2026-11-03');
  });
  it('cruza meses y años', () => {
    expect(dayKey(new Date(2027, 0, 1, 2))).toBe('2026-12-31');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('tarjetas nuevas / en aprendizaje', () => {
  it('estado inicial', () => {
    const s = fresh();
    expect(s).toMatchObject({ ease: 2.5, interval: 0, reps: 0, lapses: 0, state: 'learning', step: 0 });
  });
  it('Otra vez → paso 0 (1 min)', () => {
    const s = run(fresh(), [2, 0]);
    expect(s.state).toBe('learning');
    expect(s.step).toBe(0);
    expect(learningDueAt(s)).toBe(NOW.getTime() + 60_000);
  });
  it('Difícil → repite el paso actual', () => {
    expect(run(fresh(), [1]).step).toBe(0);
    const s = run(fresh(), [2, 1]);
    expect(s.step).toBe(1);
    expect(learningDueAt(s)).toBe(NOW.getTime() + 10 * 60_000);
  });
  it('Bien → avanza; al terminar los pasos pasa a review con intervalo 1', () => {
    const s1 = run(fresh(), [2]);
    expect(s1).toMatchObject({ state: 'learning', step: 1 });
    const s2 = run(s1, [2]);
    expect(s2).toMatchObject({ state: 'review', interval: 1, due: '2026-11-04', ease: 2.5 });
    expect(s2.step).toBeUndefined();
  });
  it('Fácil → directo a review con intervalo 4', () => {
    expect(run(fresh(), [3])).toMatchObject({ state: 'review', interval: 4, due: '2026-11-07' });
  });
  it('estudiar de madrugada programa desde el día lógico anterior', () => {
    expect(run(fresh(), [3], at(2)).due).toBe('2026-11-06');
  });
  it('no modifica el estado original', () => {
    const s = fresh();
    review(s, 3, NOW);
    expect(s.state).toBe('learning');
  });
});

describe('tarjetas en repaso', () => {
  it('Otra vez → lapses++, ease -0.20, reaprendizaje de 10 min y luego intervalo a la mitad', () => {
    const s = run(reviewCard(), [0]);
    expect(s).toMatchObject({ state: 'relearning', step: 0, lapses: 1, ease: 2.3, reps: 0 });
    expect(learningDueAt(s)).toBe(NOW.getTime() + 10 * 60_000);
    const g = run(s, [2]);
    expect(g).toMatchObject({ state: 'review', interval: 5, due: '2026-11-08' });
  });
  it('el intervalo tras un fallo nunca baja de 1', () => {
    expect(run(reviewCard({ interval: 1 }), [0, 2]).interval).toBe(1);
  });
  it('Difícil → ease -0.15, intervalo max(i+1, i*1.2)', () => {
    expect(run(reviewCard(), [1])).toMatchObject({ ease: 2.35, interval: 12, due: '2026-11-15' });
    expect(run(reviewCard({ interval: 1 }), [1]).interval).toBe(2);
  });
  it('Bien → intervalo max(i+1, i*ease)', () => {
    expect(run(reviewCard(), [2])).toMatchObject({ ease: 2.5, interval: 25, reps: 4 });
    expect(run(reviewCard({ interval: 1, ease: 1.3 }), [2]).interval).toBe(2);
  });
  it('Fácil → ease +0.15, intervalo max(i+1, i*ease*1.3)', () => {
    expect(run(reviewCard(), [3])).toMatchObject({ ease: 2.65, interval: 34 });
  });
  it('ease nunca baja de 1.3 ni sube de 3.0', () => {
    expect(run(reviewCard({ ease: 1.35 }), [0]).ease).toBe(1.3);
    expect(run(reviewCard({ ease: 1.3 }), [1]).ease).toBe(1.3);
    expect(run(reviewCard({ ease: 2.95 }), [3]).ease).toBe(3);
    expect(run(reviewCard({ ease: 3 }), [3]).ease).toBe(3);
    expect(clampEase(0.5)).toBe(1.3);
    expect(clampEase(9)).toBe(3);
  });
  it('muchos fallos seguidos mantienen ease en el mínimo', () => {
    let s = reviewCard();
    for (let i = 0; i < 20; i++) s = run(s, [0, 2]);
    expect(s.ease).toBe(1.3);
    expect(s.lapses).toBe(20);
  });
});

describe('textos de intervalo', () => {
  it('previsualiza los cuatro botones', () => {
    expect(previewIntervals(fresh(), NOW)).toEqual(['1 min', '1 min', '10 min', '4 días']);
    expect(previewIntervals(run(fresh(), [2]), NOW)).toEqual(['1 min', '10 min', '1 día', '4 días']);
    expect(previewIntervals(reviewCard(), NOW)).toEqual(['10 min', '12 días', '25 días', '1 mes']);
  });
  it('meses y años', () => {
    expect(formatInterval(reviewCard({ interval: 90 }))).toBe('3 meses');
    expect(formatInterval(reviewCard({ interval: 548 }))).toBe('1,5 años');
  });
});
