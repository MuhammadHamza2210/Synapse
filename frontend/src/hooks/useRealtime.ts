import { useEffect, useRef } from 'react'
import { wsUrl } from '@/lib/api'
import { useStore } from '@/store/useStore'

/**
 * Keeps a WebSocket open to the backend and turns "concepts.pulse" events into
 * store updates, so the Mind Palace lights up the moment the tutor cites a concept.
 */
export function useRealtime() {
  const setPulsed = useStore((s) => s.setPulsed)
  const ref = useRef<WebSocket | null>(null)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    function connect() {
      try {
        const ws = new WebSocket(wsUrl())
        ref.current = ws
        ws.onmessage = (ev) => {
          try {
            const { event, payload } = JSON.parse(ev.data)
            if (event === 'concepts.pulse' && Array.isArray(payload?.concept_ids)) {
              setPulsed(payload.concept_ids)
            }
          } catch {
            /* ignore malformed frames */
          }
        }
        ws.onclose = () => {
          if (!closed) retry = setTimeout(connect, 2500)
        }
        ws.onerror = () => ws.close()
      } catch {
        if (!closed) retry = setTimeout(connect, 2500)
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ref.current?.close()
    }
  }, [setPulsed])
}
