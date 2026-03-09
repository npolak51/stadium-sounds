import type { AtBatResult } from '../types'

const AT_BAT_RESULTS: { value: AtBatResult; label: string }[] = [
  { value: 'hit', label: 'Hit' },
  { value: 'out', label: 'Out' },
  { value: 'strikeout', label: 'K' },
  { value: 'walk', label: 'BB' },
  { value: 'error', label: 'Error' },
  { value: 'catchers_interference', label: "Catcher's Int." },
]

interface Props {
  onResult: (result: AtBatResult) => void
}

export function AtBatResultInput({ onResult }: Props) {
  return (
    <div className="at-bat-result-input">
      <span className="label">End of at-bat</span>
      <div className="result-buttons">
        {AT_BAT_RESULTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="result-btn"
            onClick={() => onResult(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
