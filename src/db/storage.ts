// Persistencia local en IndexedDB (docs/SPEC.md, secciones 6.2 y 6.3).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { addDays, dayKey } from '../srs/sm2';
import {
  LANGS,
  type BackupFile,
  type Grade,
  type LangCode,
  type Meta,
  type ReviewLog,
  type ReviewState,
  type Settings,
} from '../types';

export const DB_NAME = 'powerspeak';
export const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;

interface PowerSpeakDB extends DBSchema {
  reviews: { key: string; value: ReviewState; indexes: { lang: LangCode } };
  logs: { key: number; value: ReviewLog; indexes: { lang: LangCode; reviewedAt: string } };
  settings: { key: string; value: Settings };
  meta: { key: string; value: Meta };
}

const SETTINGS_KEY = 'settings';
const META_KEY = 'meta';

const perLang = <T,>(make: () => T) =>
  Object.fromEntries(LANGS.map((l) => [l, make()])) as Record<LangCode, T>;

export function defaultSettings(): Settings {
  return {
    autoplay: false,
    showFurigana: true,
    showPinyin: true,
    showRomanization: false,
    speechRate: 0.9,
    theme: 'sistema',
    langs: perLang(() => ({ newPerDay: 10, maxReviewsPerDay: 200, reverse: false })),
  };
}

export function defaultMeta(today: string): Meta {
  return {
    streak: 0,
    lastStudyDate: null,
    newIntroducedToday: perLang(() => 0),
    reviewsDoneToday: perLang(() => 0),
    dayKey: today,
  };
}

// ---------- Lógica pura (con tests) ----------

/** Completa con valores por defecto lo que falte (p. ej. ajustes nuevos tras una actualización). */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!stored) return d;
  const langs = perLang(() => ({}) as Settings['langs'][LangCode]);
  for (const l of LANGS) langs[l] = { ...d.langs[l], ...(stored.langs?.[l] ?? {}) };
  return { ...d, ...stored, langs };
}

/** Si cambió el día lógico, reinicia los contadores diarios (corte 4:00 a.m.). */
export function rollDay(meta: Meta, today: string): Meta {
  if (meta.dayKey === today) return meta;
  return { ...meta, dayKey: today, newIntroducedToday: perLang(() => 0), reviewsDoneToday: perLang(() => 0) };
}

/** Marca que hoy se estudió: la racha sube si ayer también, se reinicia a 1 si se saltó un día. */
export function updateStreak(meta: Meta, today: string): Meta {
  if (meta.lastStudyDate === today) return meta;
  const streak = meta.lastStudyDate === addDays(today, -1) ? meta.streak + 1 : 1;
  return { ...meta, streak, lastStudyDate: today };
}

/** Racha que se muestra: 0 si el último día de estudio fue antes de ayer. */
export function currentStreak(meta: Meta, today: string): number {
  if (!meta.lastStudyDate) return 0;
  return meta.lastStudyDate === today || meta.lastStudyDate === addDays(today, -1) ? meta.streak : 0;
}

/** Valida un respaldo importado; lanza un Error con mensaje en español si no es válido. */
export function parseBackup(data: unknown): BackupFile {
  const fail = (msg: string): never => {
    throw new Error(`El archivo no es un respaldo válido de PowerSpeak: ${msg}.`);
  };
  if (!data || typeof data !== 'object') fail('no es un objeto JSON');
  const b = data as Partial<BackupFile>;
  if (b.app !== 'PowerSpeak') fail('falta la marca "PowerSpeak"');
  if (typeof b.schemaVersion !== 'number') fail('falta schemaVersion');
  if (b.schemaVersion! > SCHEMA_VERSION)
    fail(`la versión ${b.schemaVersion} es más nueva que la de esta app (${SCHEMA_VERSION}); actualiza la app`);
  if (!Array.isArray(b.reviews)) fail('falta la lista de repasos');
  if (!Array.isArray(b.logs)) fail('falta el historial');
  for (const r of b.reviews!) {
    if (!r || typeof r.cardId !== 'string' || !LANGS.includes(r.lang) || typeof r.due !== 'string')
      fail('hay un estado de tarjeta incompleto');
  }
  for (const l of b.logs!) {
    if (!l || typeof l.cardId !== 'string' || !LANGS.includes(l.lang) || typeof l.reviewedAt !== 'string')
      fail('hay un registro del historial incompleto');
  }
  const today = dayKey(new Date());
  return {
    app: 'PowerSpeak',
    schemaVersion: b.schemaVersion!,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    reviews: b.reviews!,
    logs: b.logs!,
    settings: mergeSettings(b.settings),
    meta: { ...defaultMeta(today), ...(b.meta ?? {}) },
  };
}

// ---------- IndexedDB ----------

let dbPromise: Promise<IDBPDatabase<PowerSpeakDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PowerSpeakDB>> {
  dbPromise ??= openDB<PowerSpeakDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const reviews = db.createObjectStore('reviews', { keyPath: 'cardId' });
      reviews.createIndex('lang', 'lang');
      const logs = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      logs.createIndex('lang', 'lang');
      logs.createIndex('reviewedAt', 'reviewedAt');
      db.createObjectStore('settings');
      db.createObjectStore('meta');
    },
  });
  return dbPromise;
}

/** Cierra la conexión (para tests). */
export async function closeDB(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

/** Pide al navegador que no borre los datos por falta de espacio (sobre todo en móviles). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await (await getDB()).get('settings', SETTINGS_KEY));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await getDB()).put('settings', settings, SETTINGS_KEY);
}

/** Meta con los contadores ya reiniciados si cambió el día. */
export async function getMeta(now = new Date()): Promise<Meta> {
  const today = dayKey(now);
  const stored = await (await getDB()).get('meta', META_KEY);
  return rollDay(stored ?? defaultMeta(today), today);
}

/** Estados de repaso, de todos los idiomas o de uno, indexados por cardId. */
export async function getReviewStates(lang?: LangCode): Promise<Record<string, ReviewState>> {
  const db = await getDB();
  const list = lang ? await db.getAllFromIndex('reviews', 'lang', lang) : await db.getAll('reviews');
  return Object.fromEntries(list.map((s) => [s.cardId, s]));
}

/** Historial, opcionalmente desde una fecha ISO. */
export async function getLogs(sinceIso?: string): Promise<ReviewLog[]> {
  const db = await getDB();
  return sinceIso
    ? db.getAllFromIndex('logs', 'reviewedAt', IDBKeyRange.lowerBound(sinceIso))
    : db.getAll('logs');
}

/**
 * Guarda una calificación en una sola transacción: nuevo estado, registro en el historial
 * y contadores diarios / racha. `wasNew` = la tarjeta no tenía estado guardado.
 */
export async function recordReview(params: {
  next: ReviewState;
  grade: Grade;
  elapsedMs: number;
  wasNew: boolean;
  wasReview: boolean;
  now?: Date;
}): Promise<Meta> {
  const now = params.now ?? new Date();
  const today = dayKey(now);
  const { next } = params;
  const db = await getDB();
  const tx = db.transaction(['reviews', 'logs', 'meta'], 'readwrite');
  let meta = rollDay((await tx.objectStore('meta').get(META_KEY)) ?? defaultMeta(today), today);
  meta = updateStreak(meta, today);
  if (params.wasNew)
    meta = { ...meta, newIntroducedToday: { ...meta.newIntroducedToday, [next.lang]: meta.newIntroducedToday[next.lang] + 1 } };
  if (params.wasReview)
    meta = { ...meta, reviewsDoneToday: { ...meta.reviewsDoneToday, [next.lang]: meta.reviewsDoneToday[next.lang] + 1 } };
  await Promise.all([
    tx.objectStore('reviews').put(next),
    tx.objectStore('logs').add({
      cardId: next.cardId,
      lang: next.lang,
      grade: params.grade,
      reviewedAt: now.toISOString(),
      elapsedMs: Math.max(0, Math.round(params.elapsedMs)),
    }),
    tx.objectStore('meta').put(meta, META_KEY),
    tx.done,
  ]);
  return meta;
}

/** Borra el progreso de un idioma (estados e historial). La racha se conserva. */
export async function resetLang(lang: LangCode): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['reviews', 'logs', 'meta'], 'readwrite');
  for (const store of ['reviews', 'logs'] as const) {
    let cursor = await tx.objectStore(store).index('lang').openCursor(lang);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  const metaStore = tx.objectStore('meta');
  const meta = await metaStore.get(META_KEY);
  if (meta)
    await metaStore.put(
      {
        ...meta,
        newIntroducedToday: { ...meta.newIntroducedToday, [lang]: 0 },
        reviewsDoneToday: { ...meta.reviewsDoneToday, [lang]: 0 },
      },
      META_KEY,
    );
  await tx.done;
}

export async function exportData(now = new Date()): Promise<BackupFile> {
  const db = await getDB();
  return {
    app: 'PowerSpeak',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    reviews: await db.getAll('reviews'),
    logs: await db.getAll('logs'),
    settings: await getSettings(),
    meta: await getMeta(now),
  };
}

export function backupFileName(now = new Date()): string {
  return `powerspeak-respaldo-${dayKey(now)}.json`;
}

/** Reemplaza todo el progreso por el del respaldo. Valida antes de borrar nada. */
export async function importData(data: unknown): Promise<void> {
  const backup = parseBackup(data);
  const db = await getDB();
  const tx = db.transaction(['reviews', 'logs', 'settings', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('reviews').clear(),
    tx.objectStore('logs').clear(),
    tx.objectStore('settings').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await Promise.all([
    ...backup.reviews.map((r) => tx.objectStore('reviews').put(r)),
    ...backup.logs.map((l) => tx.objectStore('logs').put(l)),
    tx.objectStore('settings').put(backup.settings, SETTINGS_KEY),
    tx.objectStore('meta').put(backup.meta, META_KEY),
    tx.done,
  ]);
}
