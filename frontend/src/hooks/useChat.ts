import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { streamQuery } from '@/lib/api'
import { useStore } from '@/store/useStore'
import type { ChatMessage } from '@/types'

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hi — I'm Synapse. Ask me anything about your documents and I'll answer with citations. Try “How does backpropagation relate to gradient descent?”",
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [sessionId, setSessionId] = useState<number | undefined>(undefined)
  const [isThinking, setIsThinking] = useState(false)
  const setPulsed = useStore((s) => s.setPulsed)
  const qc = useQueryClient()

  function patchLast(patch: Partial<ChatMessage>) {
    setMessages((m) => {
      const next = [...m]
      next[next.length - 1] = { ...next[next.length - 1], ...patch }
      return next
    })
  }

  async function send(question: string) {
    const q = question.trim()
    if (!q || isThinking) return
    setMessages((m) => [
      ...m,
      { role: 'user', content: q },
      { role: 'assistant', content: '', pending: true },
    ])
    setIsThinking(true)

    let streamed = ''
    await streamQuery(q, sessionId, {
      onMeta: (meta) => {
        setSessionId(meta.session_id)
        setPulsed(meta.concept_ids)
        // keep `pending` (thinking dots) until the first token actually arrives
        patchLast({ citations: meta.citations, concept_ids: meta.concept_ids })
      },
      onToken: (text) => {
        streamed += text
        patchLast({ content: streamed, pending: false })
      },
      onDone: (d) => {
        patchLast({ mode: d.mode, pending: false })
        qc.invalidateQueries({ queryKey: ['sessions'] })
      },
      onError: () => {
        patchLast({
          content:
            'Something went wrong reaching the backend. Make sure the API is running on ' +
            (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') +
            '.',
          pending: false,
        })
      },
    })

    setIsThinking(false)
  }

  function reset() {
    setMessages([WELCOME])
    setSessionId(undefined)
  }

  return { messages, send, reset, isThinking }
}
