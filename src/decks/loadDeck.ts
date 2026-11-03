// Carga y validación de los mazos (public/decks/<lang>.json).
import { LANGS, POS_LIST, type Deck, type LangCode } from '../types';

/** Devuelve la lista de errores del mazo (vacía si es válido). */
export function validateDeck(data: unknown, lang?: LangCode): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') return ['el mazo no es un objeto JSON'];
  const d = data as Partial<Deck>;
  if (!LANGS.includes(d.lang as LangCode)) errors.push(`idioma desconocido: ${String(d.lang)}`);
  if (lang && d.lang !== lang) errors.push(`se esperaba el idioma ${lang} y el mazo es ${String(d.lang)}`);
  if (typeof d.name !== 'string' || !d.name) errors.push('falta name');
  if (typeof d.ttsLang !== 'string' || !d.ttsLang) errors.push('falta ttsLang');
  if (typeof d.version !== 'number') errors.push('falta version');
  if (!Array.isArray(d.cards) || d.cards.length === 0) return [...errors, 'no hay tarjetas'];

  const ids = new Set<string>();
  const ranks = new Set<number>();
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  d.cards.forEach((c, i) => {
    const where = `tarjeta ${i + 1}${c && typeof c.id === 'string' ? ` (${c.id})` : ''}`;
    if (!c || typeof c !== 'object') return errors.push(`${where}: no es un objeto`);
    if (!str(c.id) || !new RegExp(`^${d.lang}-\\d{4}$`).test(c.id)) errors.push(`${where}: id inválido`);
    else if (ids.has(c.id)) errors.push(`${where}: id repetido`);
    else ids.add(c.id);
    if (!str(c.term)) errors.push(`${where}: falta term`);
    if (!str(c.meaning)) errors.push(`${where}: falta meaning`);
    if (!POS_LIST.includes(c.pos)) errors.push(`${where}: pos inválido (${String(c.pos)})`);
    if (c.reading !== undefined && !str(c.reading)) errors.push(`${where}: reading vacío`);
    if (c.romanization !== undefined && !str(c.romanization)) errors.push(`${where}: romanization vacía`);
    if (c.notes !== undefined && !str(c.notes)) errors.push(`${where}: notes vacío`);
    if (!Array.isArray(c.tags) || !c.tags.every(str)) errors.push(`${where}: tags inválidos`);
    if (!Number.isInteger(c.rank) || c.rank < 1) errors.push(`${where}: rank inválido`);
    else if (ranks.has(c.rank)) errors.push(`${where}: rank repetido`);
    else ranks.add(c.rank);
    if (c.example !== undefined) {
      const e = c.example;
      if (!e || !str(e.text) || !str(e.translation) || (e.reading !== undefined && !str(e.reading)))
        errors.push(`${where}: ejemplo incompleto`);
    }
  });
  return errors;
}

const cache = new Map<LangCode, Promise<Deck>>();

/** Descarga (o toma del caché del service worker) y valida un mazo. */
export function loadDeck(lang: LangCode): Promise<Deck> {
  let p = cache.get(lang);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}decks/${lang}.json`).then(async (r) => {
      if (!r.ok) throw new Error(`No se pudo cargar el mazo (${r.status}).`);
      const data: unknown = await r.json();
      const errors = validateDeck(data, lang);
      if (errors.length) throw new Error(`El mazo tiene errores: ${errors.slice(0, 3).join('; ')}`);
      return data as Deck;
    });
    p.catch(() => cache.delete(lang));
    cache.set(lang, p);
  }
  return p;
}
