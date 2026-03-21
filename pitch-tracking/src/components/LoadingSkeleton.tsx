interface Props {
  variant?: 'page' | 'list' | 'card'
}

export function LoadingSkeleton({ variant = 'page' }: Props) {
  if (variant === 'page') {
    return (
      <div className="loading-skeleton page-skeleton">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-subtitle" />
        <div className="skeleton-block" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="loading-skeleton list-skeleton">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-list-item" />
        ))}
      </div>
    )
  }

  return (
    <div className="loading-skeleton card-skeleton">
      <div className="skeleton-block" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  )
}
