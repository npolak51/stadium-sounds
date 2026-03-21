interface Props {
  message: string
  onRetry?: () => void
}

export function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="error-message">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="retry-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
