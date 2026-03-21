import { usePwaUpdate } from '../contexts/PwaUpdateContext'
import './UpdateBanner.css'

export function UpdateBanner() {
  const ctx = usePwaUpdate()
  if (!ctx?.updateAvailable) return null

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">Update available. Refresh to get the latest version.</span>
      <button type="button" className="update-banner-btn" onClick={ctx.reload}>
        Refresh
      </button>
    </div>
  )
}
