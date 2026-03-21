import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="offline-indicator" role="status">
      No connection — data saved locally
    </div>
  )
}
