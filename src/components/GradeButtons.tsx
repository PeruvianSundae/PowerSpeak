import type { Grade } from '../types';

const LABELS = ['Otra vez', 'Difícil', 'Bien', 'Fácil'];

export default function GradeButtons({
  intervals,
  disabled,
  onGrade,
}: {
  intervals: string[];
  disabled?: boolean;
  onGrade: (g: Grade) => void;
}) {
  return (
    <div className="grades">
      {LABELS.map((label, g) => (
        <button
          key={label}
          type="button"
          className={`grade grade-${g}`}
          disabled={disabled}
          onClick={() => onGrade(g as Grade)}
          title={`Tecla ${g + 1}`}
        >
          <span className="grade-label">{label}</span>
          <span className="grade-ivl">{intervals[g]}</span>
        </button>
      ))}
    </div>
  );
}
