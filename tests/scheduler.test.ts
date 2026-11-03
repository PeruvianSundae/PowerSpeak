import { describe, expect, it } from 'vitest';
import {
  afterReview,
  buildQueue,
  deckCounts,
  interleave,
  nextItem,
  type QueueLimits,
  type SessionState,
} from '../src/srs/scheduler';
import { initialState, review } from '../src/srs/sm2';
import type { Card, ReviewState } from '../src/types';

const NOW = new Date(2026, 10, 3, 10, 0);
const card = (n: number): Card => ({
  id: `pt-${String(n).padStart(4, '0')}`,
  term: `t${n}`,
  meaning: `m${n}`,
  pos: 'sustantivo',
  tags: ['A1'],
  rank: n,
});
const cards = Array.from({ length: 30 }, (_, i) => card(i + 1));
const limits = (over: Partial<QueueLimits> = {}): QueueLimits => ({
  newPerDay: 10,
  maxReviewsPerDay: 200,
  newIntroducedToday: 0,
  reviewsDoneToday: 0,
  ...over,
});
const reviewState = (id: string, due: string): ReviewState => ({
  ...initialState(id, 'pt', NOW),
  state: 'review',
  step: undefined,
  interval: 3,
  due,
  lastReviewed: new Date(2026, 9, 30).toISOString(),
});
const learningState = (id: string, minutesAgo: number, step = 0): ReviewState => ({
  ...initialState(id, 'pt', NOW),
  step,
  lastReviewed: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
});

describe('buildQueue', () => {
  it('sin progreso: solo nuevas, en orden de rank y hasta el límite diario', () => {
    const shuffled = [...cards].reverse();
    const q = buildQueue(shuffled, {}, NOW, limits());
    expect(q).toHaveLength(10);
    expect(q.every((i) => i.kind === 'new')).toBe(true);
    expect(q[0].cardId).toBe('pt-0001');
    expect(q[9].cardId).toBe('pt-0010');
  });

  it('respeta las nuevas ya introducidas hoy', () => {
    expect(buildQueue(cards, {}, NOW, limits({ newIntroducedToday: 7 }))).toHaveLength(3);
    expect(buildQueue(cards, {}, NOW, limits({ newIntroducedToday: 12 }))).toHaveLength(0);
  });

  it('orden: aprendizaje vencido, luego repasos por due, con nuevas intercaladas', () => {
    const states = {
      'pt-0001': reviewState('pt-0001', '2026-11-03'),
      'pt-0002': reviewState('pt-0002', '2026-11-01'),
      'pt-0003': reviewState('pt-0003', '2026-11-04'), // no vence hoy
      'pt-0004': learningState('pt-0004', 5), // paso 0 = 1 min → vencida
      'pt-0005': learningState('pt-0005', 5, 1), // paso 1 = 10 min → aún no
      'pt-0006': reviewState('pt-0006', '2026-11-02'),
    };
    const q = buildQueue(cards, states, NOW, limits({ newPerDay: 3 }));
    expect(q[0]).toEqual({ cardId: 'pt-0004', kind: 'learning' });
    const reviews = q.filter((i) => i.kind === 'review').map((i) => i.cardId);
    expect(reviews).toEqual(['pt-0002', 'pt-0006', 'pt-0001']);
    const news = q.filter((i) => i.kind === 'new').map((i) => i.cardId);
    expect(news).toEqual(['pt-0007', 'pt-0008', 'pt-0009']);
    expect(q.map((i) => i.kind)).toEqual(['learning', 'review', 'new', 'review', 'new', 'review', 'new']);
    expect(q.find((i) => i.cardId === 'pt-0003' || i.cardId === 'pt-0005')).toBeUndefined();
  });

  it('respeta el máximo de repasos por día', () => {
    const states = Object.fromEntries(cards.map((c) => [c.id, reviewState(c.id, '2026-11-01')]));
    expect(buildQueue(cards, states, NOW, limits({ maxReviewsPerDay: 5 }))).toHaveLength(5);
    expect(buildQueue(cards, states, NOW, limits({ maxReviewsPerDay: 5, reviewsDoneToday: 4 }))).toHaveLength(1);
  });

  it('el límite de nuevas se reinicia al día siguiente (corte 4:00 a.m.)', () => {
    // A las 3:00 del 4 nov todavía es el día lógico 3 nov: el repaso con due 4 nov no vence.
    const states = { 'pt-0001': reviewState('pt-0001', '2026-11-04') };
    const madrugada = new Date(2026, 10, 4, 3, 0);
    expect(buildQueue(cards, states, madrugada, limits({ newPerDay: 0 }))).toHaveLength(0);
    expect(buildQueue(cards, states, new Date(2026, 10, 4, 4, 0), limits({ newPerDay: 0 }))).toHaveLength(1);
  });

  it('ignora estados de tarjetas que no están en el mazo', () => {
    const states = { 'zz-9999': reviewState('zz-9999', '2026-11-01') };
    expect(buildQueue(cards, states, NOW, limits({ newPerDay: 0 }))).toHaveLength(0);
  });
});

describe('interleave', () => {
  it('reparte uniformemente', () => {
    expect(interleave(['r1', 'r2', 'r3', 'r4'], ['n1', 'n2'])).toEqual(['r1', 'r2', 'n1', 'r3', 'r4', 'n2']);
    expect(interleave(['r1'], ['n1', 'n2', 'n3'])).toEqual(['r1', 'n1', 'n2', 'n3']);
    expect(interleave([], ['n1'])).toEqual(['n1']);
    expect(interleave(['r1'], [])).toEqual(['r1']);
  });
});

describe('deckCounts', () => {
  it('cuenta pendientes y nuevas', () => {
    const states = { 'pt-0001': reviewState('pt-0001', '2026-11-01'), 'pt-0002': learningState('pt-0002', 2) };
    expect(deckCounts(cards, states, NOW, limits())).toEqual({ due: 2, fresh: 10 });
  });
});

describe('sesión', () => {
  it('una tarjeta en aprendizaje reaparece cuando vence y la sesión termina al vaciarse', () => {
    let session: SessionState = { queue: [{ cardId: 'pt-0001', kind: 'new' }, { cardId: 'pt-0002', kind: 'new' }], learning: [] };
    let now = NOW;

    let r = nextItem(session, now)!;
    expect(r.item.cardId).toBe('pt-0001');
    let s1 = review(initialState('pt-0001', 'pt', now), 0, now); // Otra vez → 1 min
    session = afterReview(r.session, s1);

    r = nextItem(session, now)!; // aún no vence: sigue la cola principal
    expect(r.item.cardId).toBe('pt-0002');
    const s2 = review(initialState('pt-0002', 'pt', now), 3, now); // Fácil → review
    session = afterReview(r.session, s2);
    expect(session.learning).toHaveLength(1);

    // Cola vacía: se adelanta la tarjeta en aprendizaje.
    r = nextItem(session, now)!;
    expect(r.item).toEqual({ cardId: 'pt-0001', kind: 'learning' });
    now = new Date(now.getTime() + 60_000);
    s1 = review(s1, 2, now); // paso 1 (10 min)
    session = afterReview(r.session, s1);
    r = nextItem(session, now)!;
    s1 = review(s1, 2, now); // gradúa
    session = afterReview(r.session, s1);
    expect(s1.state).toBe('review');
    expect(nextItem(session, now)).toBeNull();
  });

  it('el aprendizaje vencido tiene prioridad sobre la cola principal', () => {
    const session: SessionState = {
      queue: [{ cardId: 'pt-0003', kind: 'review' }],
      learning: [{ cardId: 'pt-0009', dueAt: NOW.getTime() - 1 }],
    };
    expect(nextItem(session, NOW)!.item.cardId).toBe('pt-0009');
  });
});
