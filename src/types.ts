// Modelo de datos (docs/SPEC.md, sección 6).

export type LangCode = 'pt' | 'ja' | 'zh' | 'ru' | 'en';

export const LANGS: LangCode[] = ['pt', 'ja', 'zh', 'ru', 'en'];

export type PartOfSpeech =
  | 'sustantivo'
  | 'verbo'
  | 'adjetivo'
  | 'adverbio'
  | 'pronombre'
  | 'expresión'
  | 'número'
  | 'otro';

export interface Card {
  id: string; // "ja-0001", único y estable (no reutilizar)
  term: string;
  reading?: string; // ja: hiragana; zh: pinyin con tonos
  romanization?: string; // ja: Hepburn; ru: opcional
  meaning: string; // en español
  pos: PartOfSpeech;
  example?: { text: string; reading?: string; translation: string };
  tags: string[];
  rank: number; // orden de introducción (1 = primera)
  notes?: string;
}

export interface Deck {
  lang: LangCode;
  name: string;
  ttsLang: string;
  version: number;
  cards: Card[];
}

/** Calificaciones: Otra vez = 0, Difícil = 1, Bien = 2, Fácil = 3. */
export type Grade = 0 | 1 | 2 | 3;

export interface ReviewState {
  cardId: string;
  lang: LangCode;
  reps: number; // repeticiones correctas seguidas
  lapses: number; // veces olvidada
  ease: number; // inicia en 2.5, rango [1.3, 3.0]
  interval: number; // días
  due: string; // YYYY-MM-DD (día lógico, corte 4:00 a.m.)
  lastReviewed: string; // ISO datetime
  state: 'learning' | 'review' | 'relearning';
  step?: number; // índice en los pasos de aprendizaje
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  lang: LangCode;
  grade: Grade;
  reviewedAt: string; // ISO datetime
  elapsedMs: number;
}
