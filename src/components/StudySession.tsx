import { useEffect, useMemo, useRef, useState } from 'react';
import { getMeta, getReviewStates, recordReview, requestPersistence } from '../db/storage';
import { loadDeck } from '../decks/loadDeck';
import {
  afterReview,
  buildQueue,
  limitsFor,
  nextItem,
  type QueueItem,
  type SessionState,
} from '../srs/scheduler';
import { initialState, learningDueAt, previewIntervals, review } from '../srs/sm2';
import { speak, voiceWarning } from '../tts/speak';
import { LANG_INFO, type Card, type Deck, type Grade, type LangCode, type ReviewState, type Settings } from '../types';
import Flashcard from './Flashcard';
import GradeButtons from './GradeButtons';

export interface SessionSummary {
  lang: LangCode;
  reviewed: number;
  newLearned: number;
  answers: number;
  correct: number;
  timeMs: number;
  streak: number;
}

interface Props {
  lang: LangCode;
  settings: Settings;
  onFinish: (summary: SessionSummary) => void;
  onExit: () => void;
}

export default function StudySession({ lang, settings, onFinish, onExit }: Props) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState('');
  const [states, setStates] = useState<Record<string, ReviewState>>({});
  const [session, setSession] = useState<SessionState>({ queue: [], learning: [] });
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [total, setTotal] = useState(0);
  const [shownAt, setShownAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [warning, setWarning] = useState('');
  const stats = useRef({ cards: new Set<string>(), newLearned: 0, answers: 0, correct: 0, timeMs: 0, streak: 0 });
  const reverse = settings.langs[lang].reverse;

  const cardsById = useMemo(() => new Map<string, Card>(deck?.cards.map((c) => [c.id, c]) ?? []), [deck]);
  const card = current ? cardsById.get(current.cardId) : undefined;

  const finish = () => {
    const s = stats.current;
    if (s.answers === 0) return onExit();
    onFinish({
      lang,
      reviewed: s.cards.size,
      newLearned: s.newLearned,
      answers: s.answers,
      correct: s.correct,
      timeMs: s.timeMs,
      streak: s.streak,
    });
  };

  const show = (s: SessionState) => {
    const r = nextItem(s, new Date());
    if (!r) return finish();
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSession(r.session);
    setCurrent(r.item);
    setRevealed(false);
    setShownAt(Date.now());
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const now = new Date();
        const [d, st, meta] = await Promise.all([loadDeck(lang), getReviewStates(lang), getMeta(now)]);
        if (!alive) return;
        const queue = buildQueue(d.cards, st, now, limitsFor(lang, settings, meta));
        const inQueue = new Set(queue.map((q) => q.cardId));
        const ids = new Set(d.cards.map((c) => c.id));
        // Tarjetas en aprendizaje que aún no vencen: entran a la sesión cuando les toque.
        const learning = Object.values(st)
          .filter((s) => s.state !== 'review' && ids.has(s.cardId) && !inQueue.has(s.cardId))
          .map((s) => ({ cardId: s.cardId, dueAt: learningDueAt(s)! }));
        setDeck(d);
        setStates(st);
        setTotal(queue.length + learning.length);
        const first = nextItem({ queue, learning }, now);
        if (!first) return setEmpty(true);
        setSession(first.session);
        setCurrent(first.item);
        setShownAt(Date.now());
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
    // La sesión se arma una sola vez al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const doSpeak = () => {
    if (!card || !deck) return;
    const r = speak(card.term, deck.ttsLang, settings.speechRate);
    setWarning(r === 'ok' ? '' : voiceWarning(lang, r));
  };

  // Audio automático: al mostrar la tarjeta (o al revelar, en modo inverso, para no dar la respuesta).
  useEffect(() => {
    if (settings.autoplay && card && revealed === reverse) doSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, revealed]);

  const grade = async (g: Grade) => {
    if (!current || !revealed || busy) return;
    setBusy(true);
    try {
      const now = new Date();
      const prev = states[current.cardId];
      const next = review(prev ?? initialState(current.cardId, lang, now), g, now);
      const elapsedMs = Math.min(60_000, Math.max(0, now.getTime() - shownAt));
      const meta = await recordReview({
        next,
        grade: g,
        elapsedMs,
        wasNew: !prev,
        wasReview: prev?.state === 'review',
        now,
      });
      if (stats.current.answers === 0) void requestPersistence();
      const s = stats.current;
      s.cards.add(next.cardId);
      if (!prev) s.newLearned++;
      s.answers++;
      if (g > 0) s.correct++;
      s.timeMs += elapsedMs;
      s.streak = meta.streak;
      setStates((old) => ({ ...old, [next.cardId]: next }));
      show(afterReview(session, next));
    } catch (e) {
      setError(`No se pudo guardar el progreso: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  // Atajos de teclado: espacio = mostrar, 1–4 = calificar, R = repetir audio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (!revealed) setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        void grade((Number(e.key) - 1) as Grade);
      } else if (e.key === 'r' || e.key === 'R') {
        doSpeak();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) {
    return (
      <div className="panel">
        <p className="error">{error}</p>
        <button type="button" className="btn" onClick={onExit}>
          Volver al inicio
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="panel center">
        <p className="big">🎉</p>
        <p>No tienes tarjetas pendientes de {LANG_INFO[lang].name.toLowerCase()} por hoy.</p>
        <p className="muted">Vuelve mañana o sube el límite de nuevas por día en Ajustes.</p>
        <button type="button" className="btn primary" onClick={onExit}>
          Volver al inicio
        </button>
      </div>
    );
  }
  if (!deck || !current || !card) return <p className="muted center">Cargando…</p>;

  const remaining = session.queue.length + session.learning.length + 1;
  const progress = total > 0 ? Math.min(1, Math.max(0, (total - remaining) / total)) : 0;
  const prev = states[current.cardId];
  const intervals = previewIntervals(prev ?? initialState(current.cardId, lang, new Date()), new Date());

  return (
    <div className="study">
      <div className="study-top">
        <button type="button" className="link" onClick={finish}>
          ✕ Terminar
        </button>
        <span className="muted small">
          {current.kind === 'new' ? 'Nueva' : current.kind === 'learning' ? 'Aprendiendo' : 'Repaso'} · quedan{' '}
          {remaining}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${progress * 100}%` }} />
      </div>
      {warning && (
        <div className="warning" role="alert">
          {warning}
          <button type="button" className="link" onClick={() => setWarning('')}>
            Cerrar
          </button>
        </div>
      )}
      <Flashcard
        card={card}
        lang={lang}
        settings={settings}
        revealed={revealed}
        reverse={reverse}
        onReveal={() => setRevealed(true)}
        onSpeak={doSpeak}
      />
      <div className="actions">
        {revealed ? (
          <GradeButtons intervals={intervals} disabled={busy} onGrade={(g) => void grade(g)} />
        ) : (
          <button type="button" className="btn primary wide" onClick={() => setRevealed(true)}>
            Mostrar respuesta
          </button>
        )}
      </div>
    </div>
  );
}

export function SessionEnd({ summary, onHome }: { summary: SessionSummary; onHome: () => void }) {
  const pct = summary.answers ? Math.round((summary.correct / summary.answers) * 100) : 0;
  const minutes = Math.max(1, Math.round(summary.timeMs / 60_000));
  return (
    <div className="panel center">
      <p className="big">🏁</p>
      <h2>¡Sesión terminada!</h2>
      <p className="muted">{LANG_INFO[summary.lang].name}</p>
      <dl className="summary">
        <div>
          <dt>Tarjetas repasadas</dt>
          <dd>{summary.reviewed}</dd>
        </div>
        <div>
          <dt>Nuevas aprendidas</dt>
          <dd>{summary.newLearned}</dd>
        </div>
        <div>
          <dt>Aciertos</dt>
          <dd>{pct} %</dd>
        </div>
        <div>
          <dt>Racha</dt>
          <dd>
            🔥 {summary.streak} {summary.streak === 1 ? 'día' : 'días'}
          </dd>
        </div>
        <div>
          <dt>Tiempo</dt>
          <dd>~{minutes} min</dd>
        </div>
      </dl>
      <button type="button" className="btn primary wide" onClick={onHome}>
        Volver al inicio
      </button>
    </div>
  );
}
