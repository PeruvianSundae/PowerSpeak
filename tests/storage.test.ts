import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  closeDB,
  currentStreak,
  defaultMeta,
  exportData,
  getLogs,
  getMeta,
  getReviewStates,
  getSettings,
  importData,
  mergeSettings,
  parseBackup,
  recordReview,
  resetLang,
  rollDay,
  saveSettings,
  updateStreak,
} from '../src/db/storage';
import { initialState, review } from '../src/srs/sm2';
import type { Grade, LangCode } from '../src/types';

const day = (d: number, h = 10) => new Date(2026, 10, d, h, 0);

async function study(cardId: string, lang: LangCode, grade: Grade, now: Date) {
  const states = await getReviewStates();
  const prev = states[cardId];
  const next = review(prev ?? initialState(cardId, lang, now), grade, now);
  return recordReview({ next, grade, elapsedMs: 4000, wasNew: !prev, wasReview: prev?.state === 'review', now });
}

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});

describe('racha y contadores (lógica pura)', () => {
  it('la racha sube con días seguidos y se reinicia si se salta uno', () => {
    let m = defaultMeta('2026-11-01');
    m = updateStreak(m, '2026-11-01');
    expect(m.streak).toBe(1);
    m = updateStreak(m, '2026-11-01');
    expect(m.streak).toBe(1);
    m = updateStreak(m, '2026-11-02');
    expect(m.streak).toBe(2);
    expect(currentStreak(m, '2026-11-03')).toBe(2); // aún puede estudiar hoy
    expect(currentStreak(m, '2026-11-04')).toBe(0); // se saltó el 3
    m = updateStreak(m, '2026-11-04');
    expect(m.streak).toBe(1);
  });
  it('rollDay reinicia los contadores al cambiar de día', () => {
    const m = { ...defaultMeta('2026-11-01'), newIntroducedToday: { ...defaultMeta('x').newIntroducedToday, ja: 10 } };
    expect(rollDay(m, '2026-11-01').newIntroducedToday.ja).toBe(10);
    expect(rollDay(m, '2026-11-02').newIntroducedToday.ja).toBe(0);
  });
  it('mergeSettings completa valores por defecto', () => {
    const s = mergeSettings({ autoplay: true, langs: { ja: { newPerDay: 5 } } } as never);
    expect(s.autoplay).toBe(true);
    expect(s.langs.ja).toEqual({ newPerDay: 5, maxReviewsPerDay: 200, reverse: false });
    expect(s.langs.ru.newPerDay).toBe(10);
  });
});

describe('IndexedDB', () => {
  it('ajustes por defecto y guardado', async () => {
    const s = await getSettings();
    expect(s.langs.pt.newPerDay).toBe(10);
    expect(s.langs.pt.maxReviewsPerDay).toBe(200);
    await saveSettings({ ...s, theme: 'oscuro' });
    await closeDB(); // simula cerrar y reabrir la app
    expect((await getSettings()).theme).toBe('oscuro');
  });

  it('recordReview guarda estado, historial, nuevas del día y racha; persiste al reabrir', async () => {
    await study('ja-0001', 'ja', 3, day(3));
    await study('ja-0002', 'ja', 2, day(3));
    await closeDB();
    const states = await getReviewStates('ja');
    expect(states['ja-0001']).toMatchObject({ state: 'review', interval: 4 });
    expect(states['ja-0002']).toMatchObject({ state: 'learning', step: 1 });
    expect(await getLogs()).toHaveLength(2);
    const meta = await getMeta(day(3));
    expect(meta.newIntroducedToday.ja).toBe(2);
    expect(meta.streak).toBe(1);
  });

  it('el contador de nuevas se reinicia al día siguiente (corte 4:00 a.m.)', async () => {
    await study('pt-0001', 'pt', 2, day(3, 23));
    expect((await getMeta(day(4, 3))).newIntroducedToday.pt).toBe(1); // 3:00 a.m. = mismo día lógico
    expect((await getMeta(day(4, 4))).newIntroducedToday.pt).toBe(0);
  });

  it('cuenta repasos del día y racha de varios días', async () => {
    await study('ru-0001', 'ru', 3, day(3)); // review, due 7 nov
    await study('ru-0001', 'ru', 2, day(7));
    const meta = await getMeta(day(7));
    expect(meta.reviewsDoneToday.ru).toBe(1);
    expect(meta.streak).toBe(1); // se saltó días
  });

  it('getLogs filtra desde una fecha', async () => {
    await study('en-0001', 'en', 2, day(1));
    await study('en-0002', 'en', 2, day(5));
    expect(await getLogs(day(4).toISOString())).toHaveLength(1);
  });

  it('resetLang borra solo ese idioma', async () => {
    await study('zh-0001', 'zh', 3, day(3));
    await study('en-0001', 'en', 3, day(3));
    await resetLang('zh');
    expect(Object.keys(await getReviewStates())).toEqual(['en-0001']);
    expect((await getLogs()).map((l) => l.lang)).toEqual(['en']);
    expect((await getMeta(day(3))).newIntroducedToday.zh).toBe(0);
  });

  it('exportar e importar en "otro navegador" restaura el progreso', async () => {
    await study('ja-0001', 'ja', 3, day(3));
    await study('pt-0001', 'pt', 2, day(3));
    await saveSettings({ ...(await getSettings()), showFurigana: false });
    const json = JSON.stringify(await exportData(day(3)));

    // Otro navegador: base de datos vacía.
    await closeDB();
    globalThis.indexedDB = new IDBFactory();
    expect(await getReviewStates()).toEqual({});

    await importData(JSON.parse(json));
    const states = await getReviewStates();
    expect(Object.keys(states).sort()).toEqual(['ja-0001', 'pt-0001']);
    expect(states['ja-0001'].interval).toBe(4);
    expect(await getLogs()).toHaveLength(2);
    expect((await getSettings()).showFurigana).toBe(false);
    expect((await getMeta(day(3))).streak).toBe(1);
  });

  it('importar reemplaza el progreso existente', async () => {
    await study('ja-0001', 'ja', 3, day(3));
    const backup = await exportData(day(3));
    await study('ru-0001', 'ru', 3, day(3));
    await importData(backup);
    expect(Object.keys(await getReviewStates())).toEqual(['ja-0001']);
  });

  it('un archivo inválido se rechaza sin borrar nada', async () => {
    await study('ja-0001', 'ja', 3, day(3));
    await expect(importData({ foo: 1 })).rejects.toThrow(/no es un respaldo válido/);
    await expect(importData({ app: 'PowerSpeak', schemaVersion: 99, reviews: [], logs: [] })).rejects.toThrow(/más nueva/);
    expect(() => parseBackup({ app: 'PowerSpeak', schemaVersion: 1, reviews: [{ cardId: 1 }], logs: [] })).toThrow();
    expect(Object.keys(await getReviewStates())).toEqual(['ja-0001']);
  });
});
