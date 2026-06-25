import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CornerDownLeft, RotateCcw, Sparkles, User } from 'lucide-react'
import clsx from 'clsx'
import { useChat } from '@/hooks/useChat'
import { ThinkingDots } from '@/components/ui/Spinner'
import { CitationChip } from './CitationChip'
import type { ChatMessage } from '@/types'

const SUGGESTIONS = [
  'How does backpropagation relate to gradient descent?',
  'Explain the two stages of photosynthesis.',
  'What caused the French Revolution?',
  'Compare respiration and photosynthesis.',
]

function Bubble({ m, streaming }: { m: ChatMessage; streaming?: boolean }) {
  const isUser = m.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex gap-3', isUser && 'flex-row-reverse')}
    >
      <div
        className={clsx(
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
          isUser ? 'bg-white/10' : 'bg-gradient-to-br from-neon-purple to-neon-cyan',
        )}
      >
        {isUser ? <User size={15} /> : <Sparkles size={15} className="text-white" />}
      </div>
      <div className={clsx('max-w-[80%]', isUser && 'text-right')}>
        <div
          className={clsx(
            'inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser ? 'bg-neon-violet/20 text-slate-100' : 'glass text-slate-200',
          )}
        >
          {m.pending ? (
            <ThinkingDots />
          ) : (
            <span className="whitespace-pre-wrap">
              {m.content}
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-neon-cyan align-middle" />
              )}
            </span>
          )}
        </div>
        {!!m.citations?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.citations.map((c) => (
              <CitationChip key={c.marker} c={c} />
            ))}
          </div>
        )}
        {m.mode === 'extractive' && !m.pending && (
          <p className="mt-1 text-[10px] text-amber-300/70">
            offline mode · run a local Ollama model for written answers
          </p>
        )}
        {(m.mode === 'ollama' || m.mode === 'claude') && !m.pending && (
          <p className="mt-1 text-[10px] text-slate-500">via {m.mode}</p>
        )}
      </div>
    </motion.div>
  )
}

export function ChatPanel() {
  const { messages, send, reset, isThinking } = useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function submit() {
    send(input)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-1 pr-2">
        {messages.map((m, i) => (
          <Bubble
            key={i}
            m={m}
            streaming={isThinking && i === messages.length - 1 && m.role === 'assistant' && !m.pending}
          />
        ))}
        {messages.length <= 1 && (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="glass px-3 py-2.5 text-left text-xs text-slate-300 transition-colors hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="glass flex items-end gap-2 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder="Ask anything about your documents…"
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button onClick={reset} className="btn-ghost px-2.5 py-2" title="New chat">
            <RotateCcw size={15} />
          </button>
          <button onClick={submit} disabled={isThinking || !input.trim()} className="btn-primary">
            <CornerDownLeft size={15} />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
