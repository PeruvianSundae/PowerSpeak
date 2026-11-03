// Cola de la sesión (docs/SPEC.md, sección 7). Funciones puras.
import type { Card, ReviewState } from '../types';
import { dayKey, learningDueAt } from './sm2';

export type QueueKind = 'learning' | 'review' | 'new';

export interface QueueItem {
  cardId: string;
  kind: QueueKind;
}

export interface QueueLimits {
  newPerDay: number; // por defecto 10
  maxReviewsPerDay: number; // por defecto 200
  newIntroducedToday: number; // nuevas ya introducidas hoy en este idioma
  reviewsDoneToday: number; // repasos ya hechos hoy en este idioma
}

/** Minutos que se puede adelantar una tarjeta en aprendizaje cuando no queda nada más (como Anki). */
export const LEARN_AHEAD_MIN = 20;

type States = Record<string, ReviewState | undefined>;

export function newRemaining(limits: QueueLimits): number {
  return Math.max(0, limits.newPerDay - limits.newIntroducedToday);
}

/** Tarjetas en aprendizaje/reaprendizaje vencidas en `now`, de la más antigua a la más reciente. */
export function dueLearning(states: ReviewState[], now: Date, aheadMs = 0): ReviewState[] {
  const limit = now.getTime() + aheadMs;
  return states
    .filter((s) => s.state !== 'review' && (learningDueAt(s) ?? Infinity) <= limit)
    .sort((a, b) => learningDueAt(a)! - learningDueAt(b)!);
}

/** Repasos con due <= hoy, ordenados por due (y luego por id para que sea estable). */
export function dueReviews(states: ReviewState[], now: Date): ReviewState[] {
  const today = dayKey(now);
  return states
    .filter((s) => s.state === 'review' && s.due <= today)
    .sort((a, b) => (a.due === b.due ? a.cardId.localeCompare(b.cardId) : a.due < b.due ? -1 : 1));
}

/** Tarjetas nunca vistas, en orden de `rank`. */
export function unseenCards(cards: Card[], states: States): Card[] {
  return cards.filter((c) => !states[c.id]).sort((a, b) => a.rank - b.rank);
}

/**
 * Arma la cola: primero aprendizaje vencido, luego repasos (due <= hoy, por due)
 * intercalando nuevas (por rank) hasta el límite diario.
 */
export function buildQueue(cards: Card[], states: States, now: Date, limits: QueueLimits): QueueItem[] {
  const deckIds = new Set(cards.map((c) => c.id));
  const all = Object.values(states).filter((s): s is ReviewState => !!s && deckIds.has(s.cardId));

  const learning = dueLearning(all, now).map((s) => ({ cardId: s.cardId, kind: 'learning' as const }));
  const reviews = dueReviews(all, now)
    .slice(0, Math.max(0, limits.maxReviewsPerDay - limits.reviewsDoneToday))
    .map((s) => ({ cardId: s.cardId, kind: 'review' as const }));
  const fresh = unseenCards(cards, states)
    .slice(0, newRemaining(limits))
    .map((c) => ({ cardId: c.id, kind: 'new' as const }));

  return [...learning, ...interleave<QueueItem>(reviews, fresh)];
}

/** Reparte las nuevas de forma uniforme entre los repasos. */
export function interleave<T>(reviews: T[], fresh: T[]): T[] {
  if (fresh.length === 0) return reviews;
  if (reviews.length === 0) return fresh;
  const out: T[] = [];
  const gap = reviews.length / fresh.length;
  let n = 0;
  reviews.forEach((r, i) => {
    out.push(r);
    while (n < fresh.length && (n + 1) * gap <= i + 1) out.push(fresh[n++]);
  });
  while (n < fresh.length) out.push(fresh[n++]);
  return out;
}

/** Contadores para la pantalla de inicio: "X pendientes · Y nuevas". */
export function deckCounts(cards: Card[], states: States, now: Date, limits: QueueLimits) {
  const q = buildQueue(cards, states, now, limits);
  const fresh = q.filter((i) => i.kind === 'new').length;
  return { due: q.length - fresh, fresh };
}

export interface SessionState {
  queue: QueueItem[]; // cola principal pendiente
  learning: { cardId: string; dueAt: number }[]; // reaparecen dentro de la sesión
}

/**
 * Siguiente tarjeta de la sesión: aprendizaje vencido primero; luego la cola principal;
 * si no queda nada, adelanta el aprendizaje que vence dentro de LEARN_AHEAD_MIN.
 * Devuelve null si la sesión terminó.
 */
export function nextItem(
  session: SessionState,
  now: Date,
): { item: QueueItem; session: SessionState } | null {
  const t = now.getTime();
  const learning = [...session.learning].sort((a, b) => a.dueAt - b.dueAt);
  const first = learning[0];
  if (first && (first.dueAt <= t || session.queue.length === 0) && first.dueAt <= t + LEARN_AHEAD_MIN * 60_000) {
    return {
      item: { cardId: first.cardId, kind: 'learning' },
      session: { queue: session.queue, learning: learning.slice(1) },
    };
  }
  if (session.queue.length > 0) {
    const [item, ...queue] = session.queue;
    return { item, session: { queue, learning: session.learning } };
  }
  return null;
}

/** Tras calificar: si la tarjeta sigue en aprendizaje, vuelve a la sesión cuando venza. */
export function afterReview(session: SessionState, next: ReviewState): SessionState {
  const learning = session.learning.filter((l) => l.cardId !== next.cardId);
  const dueAt = learningDueAt(next);
  if (dueAt !== null) learning.push({ cardId: next.cardId, dueAt });
  return { queue: session.queue.filter((q) => q.cardId !== next.cardId), learning };
}
