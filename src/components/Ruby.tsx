// Furigana (japonés) y pinyin (chino) con <ruby>.
import type { LangCode } from '../types';

export interface RubyPart {
  text: string;
  rt?: string;
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/u;
const HANZI = /[㐀-䶿一-鿿]/u;

export const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Alinea la lectura con los kanji: 食べる + たべる → 食(た)べる. Si no puede, la pone sobre todo el término. */
export function alignFurigana(term: string, reading: string): RubyPart[] {
  const segs: { text: string; kanji: boolean }[] = [];
  for (const ch of term) {
    const kanji = KANJI.test(ch);
    const last = segs[segs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else segs.push({ text: ch, kanji });
  }
  if (!segs.some((s) => s.kanji)) return [{ text: term }];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${segs.map((s) => (s.kanji ? '(.+?)' : esc(toHiragana(s.text)))).join('')}$`, 'u');
  const m = toHiragana(reading).match(re);
  if (!m) return [{ text: term, rt: reading }];
  let i = 1;
  return segs.map((s) => (s.kanji ? { text: s.text, rt: m[i++] } : { text: s.text }));
}

/** Pinyin sílaba por sílaba si coincide con el número de caracteres (reading separado por espacios). */
export function alignPinyin(term: string, reading: string): RubyPart[] {
  const chars = [...term];
  const syllables = reading.trim().split(/\s+/);
  if (chars.every((c) => HANZI.test(c)) && chars.length === syllables.length)
    return chars.map((c, i) => ({ text: c, rt: syllables[i] }));
  return [{ text: term, rt: reading }];
}

export default function Ruby({
  lang,
  text,
  reading,
  show,
}: {
  lang: LangCode;
  text: string;
  reading?: string;
  show: boolean;
}) {
  if (!show || !reading || (lang !== 'ja' && lang !== 'zh')) return <>{text}</>;
  const parts = lang === 'ja' ? alignFurigana(text, reading) : alignPinyin(text, reading);
  return (
    <>
      {parts.map((p, i) =>
        p.rt ? (
          <ruby key={i}>
            {p.text}
            <rp>(</rp>
            <rt>{p.rt}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
