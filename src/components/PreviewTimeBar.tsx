import './PreviewTimeBar.css'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const tenths = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}:${tenths}`
}

interface PreviewTimeBarProps {
  fileDuration: number
  startTime: number
  endTime: number
  /** Current playback position in full file (when previewing), or null */
  currentPosition: number | null
  onSeek: (seconds: number) => void
}

export default function PreviewTimeBar({
  fileDuration,
  startTime,
  endTime,
  currentPosition,
  onSeek
}: PreviewTimeBarProps) {
  if (fileDuration <= 0) return null

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const seconds = pct * fileDuration
    onSeek(seconds)
  }

  const startPct = (startTime / fileDuration) * 100
  const endPct = ((endTime - startTime) / fileDuration) * 100
  const playheadPct = currentPosition != null ? (currentPosition / fileDuration) * 100 : null

  return (
    <div className="preview-time-bar">
      <div
        className="preview-time-bar-track"
        onClick={handleClick}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={fileDuration}
        aria-valuenow={currentPosition ?? startTime}
        aria-label="Seek in audio"
      >
        <div className="preview-time-bar-bg" />
        <div
          className="preview-time-bar-range"
          style={{ left: `${startPct}%`, width: `${endPct}%` }}
        />
        {playheadPct != null && (
          <div
            className="preview-time-bar-playhead"
            style={{ left: `${playheadPct}%` }}
          />
        )}
      </div>
      <div className="preview-time-bar-labels">
        <span className="preview-time-bar-current">
          {formatTime(currentPosition ?? startTime)}
        </span>
        <span className="preview-time-bar-total">{formatTime(fileDuration)}</span>
      </div>
    </div>
  )
}
