import { useEffect, useState } from 'react';
import { currentStreak, getMeta, getReviewStates } from '../db/storage';
import { loadDeck } from '../decks/loadDeck';
import { deckCounts, limitsFor } from '../srs/scheduler';
import { dayKey } from '../srs/sm2';
import { LANG_INFO, LANGS, type LangCode, type Settings } from '../types';

type Counts = { due: number; fresh: number } | null;

export default function LanguagePicker({
  settings,
  onStudy,
}: {
  settings: Settings;
  onStudy: (lang: LangCode) => void;
}) {
  const [counts, setCounts] = useState<Partial<Record<LangCode, Counts>>>({});
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const now = new Date();
      const [states, meta] = await Promise.all([getReviewStates(), getMeta(now)]);
      if (alive) setStreak(currentStreak(meta, dayKey(now)));
      await Promise.all(
        LANGS.map(async (l) => {
          let c: Counts = null;
          try {
            const deck = await loadDeck(l);
            c = deckCounts(deck.cards, states, now, limitsFor(l, settings, meta));
          } catch {
            c = null;
          }
          if (alive) setCounts((old) => ({ ...old, [l]: c }));
        }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [settings]);

  return (
    <div>
      <div className="streak">
        🔥 <strong>{streak}</strong> {streak === 1 ? 'día' : 'días'} de racha
      </div>
      <ul className="langs">
        {LANGS.map((l) => {
          const c = counts[l];
          return (
            <li key={l}>
              <button type="button" className="lang" onClick={() => onStudy(l)} disabled={c === null}>
                <span className="flag" aria-hidden="true">
                  {LANG_INFO[l].flag}
                </span>
                <span className="lang-text">
                  <span className="lang-name">{LANG_INFO[l].name}</span>
                  <span className="lang-counts">
                    {c === undefined
                      ? 'Cargando…'
                      : c === null
                        ? 'Mazo no disponible'
                        : `${c.due} pendientes · ${c.fresh} nuevas`}
                  </span>
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
