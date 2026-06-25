import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const STORAGE_KEY = 'synapse:path-done'

function loadLocal(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveLocal(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

/**
 * Learning-path progress that lives in localStorage when signed out, and syncs to
 * the server (across devices) when signed in. On sign-in, local progress is merged
 * up so nothing is lost.
 */
export function useProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [done, setDone] = useState<Set<string>>(loadLocal)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function sync() {
      if (userId == null) {
        setDone(loadLocal())
        return
      }
      setSyncing(true)
      try {
        const serverKeys = await api.getProgress()
        const union = new Set<string>([...serverKeys, ...loadLocal()])
        if (cancelled) return
        setDone(union)
        if (union.size !== serverKeys.length) await api.putProgress([...union])
      } catch {
        /* fall back to whatever is in state */
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }
    sync()
    return () => {
      cancelled = true
    }
  }, [userId])

  const commit = useCallback(
    (next: Set<string>) => {
      setDone(new Set(next))
      if (userId == null) saveLocal(next)
      else api.putProgress([...next]).catch(() => {})
    },
    [userId],
  )

  const toggle = useCallback(
    (key: string) => {
      setDone((prev) => {
        const next = new Set(prev)
        next.has(key) ? next.delete(key) : next.add(key)
        if (userId == null) saveLocal(next)
        else api.putProgress([...next]).catch(() => {})
        return next
      })
    },
    [userId],
  )

  const reset = useCallback(() => commit(new Set()), [commit])

  return { done, toggle, reset, syncing, isAuthed: userId != null }
}
