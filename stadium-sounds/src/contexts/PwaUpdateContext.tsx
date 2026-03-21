import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react'

interface PwaUpdateContextValue {
  updateAvailable: boolean
  reload: () => void
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null)

export function PwaUpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const updateSwRef = useRef<(() => void) | null>(null)

  const reload = useCallback(() => {
    updateSwRef.current?.()
  }, [])

  useEffect(() => {
    if (typeof import.meta.env.DEV !== 'undefined' && import.meta.env.DEV) {
      return
    }
    import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          setUpdateAvailable(true)
        },
        onOfflineReady() {
          // App is ready to work offline; no action needed
        }
      })
      updateSwRef.current = updateSW
    })
  }, [])

  const value: PwaUpdateContextValue = {
    updateAvailable,
    reload
  }

  return (
    <PwaUpdateContext.Provider value={value}>
      {children}
    </PwaUpdateContext.Provider>
  )
}

export function usePwaUpdate() {
  return useContext(PwaUpdateContext)
}
