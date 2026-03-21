import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/tracking', label: 'Tracking' },
  { path: '/reports', label: 'Reports' },
  { path: '/roster', label: 'Roster' },
  { path: '/data', label: 'Data' },
] as const

export function TabBar() {
  const location = useLocation()

  const activeTab = TABS.find((t) => {
    if (t.path === '/tracking') {
      return location.pathname === '/tracking' || location.pathname.startsWith('/tracking/')
    }
    if (t.path === '/reports') {
      return location.pathname === '/reports' || location.pathname.startsWith('/reports/')
    }
    if (t.path === '/data') {
      return location.pathname === '/data'
    }
    return location.pathname.startsWith(t.path)
  })

  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const isActive = activeTab?.path === tab.path
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={`tab-link ${isActive ? 'active' : ''}`}
          >
            {tab.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
