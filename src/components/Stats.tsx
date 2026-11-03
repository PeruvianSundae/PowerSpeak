import { useEffect, useState } from 'react';
import { currentStreak, getLogs, getMeta, getReviewStates } from '../db/storage';
import { loadDeck } from '../decks/loadDeck';
import { addDays, dayKey } from '../srs/sm2';
import { LANG_INFO, LANGS, type LangCode } from '../types';

interface LangStats {
  learned: number;
  learning: number;
  unseen: number | null;
  today: number;
  week: number;
  timeMs: number;
}

interface Data {
  streak: number;
  today: number;
  timeTodayMs: number;
  timeMs: number;
  week: { day: string; count: number }[];
  langs: Record<LangCode, LangStats>;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return ms > 0 ? '<1 min' : '0 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export default function Stats() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const now = new Date();
      const today = dayKey(now);
      const [states, logs, meta] = await Promise.all([getReviewStates(), getLogs(), getMeta(now)]);
      const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
      const logDays = logs.map((l) => ({ ...l, day: dayKey(new Date(l.reviewedAt)) }));
      const langs = {} as Record<LangCode, LangStats>;
      for (const l of LANGS) {
        const ls = Object.values(states).filter((s) => s.lang === l);
        const ll = logDays.filter((x) => x.lang === l);
        let size: number | null = null;
        try {
          size = (await loadDeck(l)).cards.length;
        } catch {
          size = null;
        }
        langs[l] = {
          learned: ls.filter((s) => s.state === 'review').length,
          learning: ls.filter((s) => s.state !== 'review').length,
          unseen: size === null ? null : Math.max(0, size - ls.length),
          today: ll.filter((x) => x.day === today).length,
          week: ll.filter((x) => x.day >= days[0]).length,
          timeMs: ll.reduce((a, x) => a + x.elapsedMs, 0),
        };
      }
      if (!alive) return;
      setData({
        streak: currentStreak(meta, today),
        today: logDays.filter((x) => x.day === today).length,
        timeTodayMs: logDays.filter((x) => x.day === today).reduce((a, x) => a + x.elapsedMs, 0),
        timeMs: logs.reduce((a, x) => a + x.elapsedMs, 0),
        week: days.map((day) => ({ day, count: logDays.filter((x) => x.day === day).length })),
        langs,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <p className="muted center">Cargando…</p>;
  const max = Math.max(1, ...data.week.map((w) => w.count));

  return (
    <div className="stats">
      <div className="tiles">
        <div className="tile">
          <span className="tile-value">🔥 {data.streak}</span>
          <span className="tile-label">días de racha</span>
        </div>
        <div className="tile">
          <span className="tile-value">{data.today}</span>
          <span className="tile-label">repasos hoy</span>
        </div>
        <div className="tile">
          <span className="tile-value">{formatDuration(data.timeTodayMs)}</span>
          <span className="tile-label">estudio hoy</span>
        </div>
        <div className="tile">
          <span className="tile-value">{formatDuration(data.timeMs)}</span>
          <span className="tile-label">tiempo total</span>
        </div>
      </div>

      <h2>Repasos de los últimos 7 días</h2>
      <div className="week" aria-label="Repasos por día">
        {data.week.map((w) => (
          <div key={w.day} className="week-col" title={`${w.day}: ${w.count}`}>
            <span className="week-count">{w.count}</span>
            <div className="week-bar" style={{ height: `${(w.count / max) * 100}%` }} />
            <span className="week-day">{WEEKDAYS[new Date(`${w.day}T12:00:00`).getDay()]}</span>
          </div>
        ))}
      </div>

      <h2>Por idioma</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Idioma</th>
              <th>Aprendidas</th>
              <th>Aprendiendo</th>
              <th>Sin ver</th>
              <th>Hoy</th>
              <th>7 días</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {LANGS.map((l) => {
              const s = data.langs[l];
              return (
                <tr key={l}>
                  <th scope="row">
                    {LANG_INFO[l].flag} {LANG_INFO[l].name}
                  </th>
                  <td>{s.learned}</td>
                  <td>{s.learning}</td>
                  <td>{s.unseen ?? '—'}</td>
                  <td>{s.today}</td>
                  <td>{s.week}</td>
                  <td>{formatDuration(s.timeMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
