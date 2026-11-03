import { describe, expect, it } from 'vitest';
import en from '../public/decks/en.json';
import ja from '../public/decks/ja.json';
import pt from '../public/decks/pt.json';
import ru from '../public/decks/ru.json';
import zh from '../public/decks/zh.json';
import { alignFurigana, alignPinyin } from '../src/components/Ruby';
import { validateDeck } from '../src/decks/loadDeck';
import { LANGS, type Deck, type LangCode } from '../src/types';

const DECKS = { pt, ja, zh, ru, en } as unknown as Record<LangCode, Deck>;
const load = (lang: LangCode): Deck => DECKS[lang];

const KANJI = /[㐀-鿿々]/u;
const HIRAGANA = /^[ぁ-ゖー]+$/u;
const HANZI = /[㐀-鿿]/u;
const ACUTE = '́';

// --- Pinyin: sílaba válida y marca de tono en la vocal correcta ---
const TONES: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü',
};
const SYLLABLE =
  /^(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|ang|eng|ing|ong|iao|ian|uai|uan|üan|ai|ei|ao|ou|an|en|in|un|ün|ia|ie|iu|ua|uo|ui|üe|ue|er|a|o|e|i|u|ü)$/;

export function pinyinProblem(raw: string): string | null {
  const s = raw.toLowerCase();
  const chars = [...s];
  const marked = chars.map((c, i) => (TONES[c] ? i : -1)).filter((i) => i >= 0);
  const base = chars.map((c) => TONES[c] ?? c).join('');
  if (!SYLLABLE.test(base)) return `sílaba de pinyin inválida: ${raw}`;
  if (marked.length > 1) return `más de una marca de tono: ${raw}`;
  if (marked.length === 1) {
    const vowels = [...base].map((c, i) => ('aeiouü'.includes(c) ? i : -1)).filter((i) => i >= 0);
    const expected = base.includes('a')
      ? base.indexOf('a')
      : base.includes('e')
        ? base.indexOf('e')
        : base.includes('ou')
          ? base.indexOf('o')
          : vowels[vowels.length - 1];
    if (marked[0] !== expected) return `marca de tono en la vocal equivocada: ${raw}`;
  }
  return null;
}

describe('mazos: esquema común', () => {
  for (const lang of LANGS) {
    describe(lang, () => {
      const deck = load(lang);
      it('pasa la validación del esquema (ids únicos, campos, rank)', () => {
        expect(validateDeck(deck, lang)).toEqual([]);
      });
      it('tiene ~100 tarjetas, cada una con significado en español y ejemplo', () => {
        expect(deck.cards.length).toBeGreaterThanOrEqual(95);
        expect(deck.cards.length).toBeLessThanOrEqual(115);
        for (const c of deck.cards) {
          expect(c.meaning.trim(), c.id).not.toBe('');
          expect(c.example?.text, c.id).toBeTruthy();
          expect(c.example?.translation, c.id).toBeTruthy();
          expect(c.tags, c.id).toContain('A1');
        }
      });
      it('ids correlativos y estables (lang-0001…)', () => {
        deck.cards.forEach((c, i) => expect(c.id).toBe(`${lang}-${String(i + 1).padStart(4, '0')}`));
      });
      it('sin términos repetidos', () => {
        const terms = deck.cards.map((c) => c.term.toLowerCase());
        expect(terms.filter((t, i) => terms.indexOf(t) !== i)).toEqual([]);
      });
      it('texto normalizado (NFC) salvo el acento combinante del ruso', () => {
        for (const c of deck.cards) {
          const t = lang === 'ru' ? c.term.split(ACUTE).join('') : c.term;
          expect(t, c.id).toBe(t.normalize('NFC'));
          expect(c.meaning, c.id).toBe(c.meaning.normalize('NFC'));
        }
      });
    });
  }
});

describe('japonés: lecturas y furigana', () => {
  const deck = load('ja');
  it('las palabras con kanji tienen lectura en hiragana que encaja con los kana del término', () => {
    for (const c of deck.cards) {
      if (!KANJI.test(c.term)) continue;
      expect(c.reading, c.id).toBeDefined();
      expect(c.reading, c.id).toMatch(HIRAGANA);
      const parts = alignFurigana(c.term, c.reading!);
      // Si el término mezcla kanji y kana, la alineación no debe caer en la lectura global.
      if (!/^[㐀-鿿々]+$/u.test(c.term)) expect(parts.length, c.id).toBeGreaterThan(1);
      expect(parts.map((p) => p.text).join(''), c.id).toBe(c.term);
    }
  });
  it('romanización Hepburn en todas las tarjetas', () => {
    for (const c of deck.cards) expect(c.romanization, c.id).toMatch(/^[A-Za-zāīūēō' -]+$/);
  });
  it('los ejemplos con kanji tienen lectura sin kanji', () => {
    for (const c of deck.cards) {
      if (!KANJI.test(c.example!.text)) continue;
      expect(c.example!.reading, c.id).toBeTruthy();
      expect(KANJI.test(c.example!.reading!), c.id).toBe(false);
    }
  });
});

describe('chino: pinyin con marcas de tono', () => {
  const deck = load('zh');
  it('una sílaba válida por carácter, sin números de tono', () => {
    for (const c of deck.cards) {
      expect(c.reading, c.id).toBeDefined();
      expect(c.reading, c.id).not.toMatch(/\d/);
      const syllables = c.reading!.split(' ');
      expect(syllables.length, c.id).toBe([...c.term].filter((ch) => HANZI.test(ch)).length);
      for (const s of syllables) expect(pinyinProblem(s), c.id).toBeNull();
      expect(alignPinyin(c.term, c.reading!).length, c.id).toBe([...c.term].length);
    }
  });
  it('los ejemplos tienen pinyin sin números ni caracteres', () => {
    for (const c of deck.cards) {
      expect(c.example!.reading, c.id).toBeTruthy();
      expect(c.example!.reading, c.id).not.toMatch(/\d/);
      expect(HANZI.test(c.example!.reading!), c.id).toBe(false);
    }
  });
  it('el validador de pinyin detecta errores', () => {
    expect(pinyinProblem('hǎo')).toBeNull();
    expect(pinyinProblem('xie')).toBeNull();
    expect(pinyinProblem('hăo')).not.toBeNull(); // breve en vez de caron
    expect(pinyinProblem('haǒ')).not.toBeNull(); // vocal equivocada
    expect(pinyinProblem('liú')).toBeNull();
    expect(pinyinProblem('lìu')).not.toBeNull();
    expect(pinyinProblem('hao3')).not.toBeNull();
  });
});

describe('ruso: acento tónico', () => {
  const deck = load('ru');
  const VOWELS = /[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/gu;
  it('cada palabra de 2+ sílabas lleva exactamente un acento (o ё), sobre una vocal', () => {
    for (const c of deck.cards) {
      expect(c.term, c.id).toMatch(/^[Ѐ-ӿ́ ?!-]+$/u);
      for (const word of c.term.split(/[\s?!-]+/).filter(Boolean)) {
        const vowels = (word.match(VOWELS) ?? []).length;
        const accents = word.split(ACUTE).length - 1;
        const yo = /[ёЁ]/u.test(word);
        if (vowels >= 2 && !yo) expect(accents, `${c.id} ${word}`).toBe(1);
        else expect(accents, `${c.id} ${word}`).toBe(0);
        const i = word.indexOf(ACUTE);
        if (i > 0) expect(word[i - 1], `${c.id} ${word}`).toMatch(VOWELS);
      }
    }
  });
  it('la romanización marca la misma sílaba tónica', () => {
    for (const c of deck.cards) {
      expect(c.romanization, c.id).toBeTruthy();
      const words = c.term.split(/[\s?!]+/).filter(Boolean);
      const roman = c.romanization!.split(/[\s?!]+/).filter(Boolean);
      expect(roman.length, c.id).toBe(words.length);
      words.forEach((w, i) => {
        const needs = w.includes(ACUTE) || /[ёЁ]/u.test(w);
        expect(/[áéíóúý]/u.test(roman[i]), `${c.id} ${roman[i]}`).toBe(needs);
      });
    }
  });
});

describe('contenido específico', () => {
  it('portugués incluye falsos amigos con nota (esquisito, polvo…)', () => {
    const deck = load('pt');
    const ff = deck.cards.filter((c) => c.tags.includes('falso amigo'));
    expect(ff.map((c) => c.term)).toEqual(expect.arrayContaining(['esquisito', 'polvo']));
    for (const c of ff) expect(c.notes, c.id).toMatch(/falso amigo/i);
  });
  it('inglés incluye phrasal verbs frecuentes', () => {
    const deck = load('en');
    expect(deck.cards.filter((c) => c.tags.includes('phrasal verb')).length).toBeGreaterThanOrEqual(5);
  });
  it('números del 1 al 10 en todos los idiomas', () => {
    for (const lang of LANGS) expect(load(lang).cards.filter((c) => c.pos === 'número').length, lang).toBe(10);
  });
});

describe('Ruby: alineación de furigana', () => {
  it('pone la lectura solo sobre los kanji', () => {
    expect(alignFurigana('食べる', 'たべる')).toEqual([{ text: '食', rt: 'た' }, { text: 'べる' }]);
    expect(alignFurigana('お金', 'おかね')).toEqual([{ text: 'お' }, { text: '金', rt: 'かね' }]);
    expect(alignFurigana('水', 'みず')).toEqual([{ text: '水', rt: 'みず' }]);
    expect(alignFurigana('コーヒー', 'こーひー')).toEqual([{ text: 'コーヒー' }]);
  });
  it('si no encaja, pone la lectura sobre todo el término', () => {
    expect(alignFurigana('食べる', 'のむ')).toEqual([{ text: '食べる', rt: 'のむ' }]);
  });
});
