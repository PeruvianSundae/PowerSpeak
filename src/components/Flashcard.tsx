import type { Card, LangCode, Settings } from '../types';
import { LANG_INFO } from '../types';
import Ruby from './Ruby';

interface Props {
  card: Card;
  lang: LangCode;
  settings: Settings;
  revealed: boolean;
  reverse: boolean;
  onReveal: () => void;
  onSpeak: () => void;
}

export default function Flashcard({ card, lang, settings, revealed, reverse, onReveal, onSpeak }: Props) {
  const htmlLang = LANG_INFO[lang].ttsLang;
  const showRuby = lang === 'ja' ? settings.showFurigana : lang === 'zh' ? settings.showPinyin : false;
  const romanization = settings.showRomanization ? card.romanization : undefined;

  const target = (
    <div className="target">
      <div className="term" lang={htmlLang}>
        <Ruby lang={lang} text={card.term} reading={card.reading} show={showRuby} />
      </div>
      {romanization && <div className="romanization">{romanization}</div>}
      <button
        type="button"
        className="audio"
        aria-label="Escuchar (R)"
        title="Escuchar (R)"
        onClick={(e) => {
          e.stopPropagation();
          onSpeak();
        }}
      >
        🔊
      </button>
    </div>
  );
  const meaning = (
    <div className="meaning-block">
      <div className="meaning">{card.meaning}</div>
      <div className="pos">{card.pos}</div>
    </div>
  );

  // Lectura en el reverso: hiragana/pinyin; en ruso, la romanización.
  const readingLine = [card.reading, card.romanization].filter(Boolean).join(' · ');
  const ex = card.example;
  const showExReading = lang === 'ja' ? settings.showFurigana : lang === 'zh' ? settings.showPinyin : true;

  return (
    <div
      className={`flashcard ${revealed ? 'revealed' : ''}`}
      onClick={revealed ? undefined : onReveal}
      role={revealed ? undefined : 'button'}
      aria-label={revealed ? undefined : 'Mostrar respuesta'}
    >
      {reverse ? meaning : target}
      {revealed && (
        <div className="back">
          <hr />
          {reverse ? target : meaning}
          {readingLine && (
            <div className="reading" lang={htmlLang}>
              {readingLine}
            </div>
          )}
          {ex && (
            <div className="example">
              <div lang={htmlLang}>{ex.text}</div>
              {ex.reading && showExReading && (
                <div className="example-reading" lang={htmlLang}>
                  {ex.reading}
                </div>
              )}
              <div className="example-tr">{ex.translation}</div>
            </div>
          )}
          {card.notes && <div className="notes">💡 {card.notes}</div>}
        </div>
      )}
    </div>
  );
}
