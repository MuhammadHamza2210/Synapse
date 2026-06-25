import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, RotateCw, Shuffle } from 'lucide-react'
import type { Flashcard } from '@/types'

export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i))
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    setOrder(cards.map((_, i) => i))
    setPos(0)
    setFlipped(false)
  }, [cards])

  if (!cards.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No flashcards for this topic yet.</p>
  }

  const card = cards[order[pos]]
  const go = (dir: number) => {
    setFlipped(false)
    setPos((p) => (p + dir + cards.length) % cards.length)
  }
  const shuffle = () => {
    // deterministic-ish rotation shuffle (no need for crypto randomness here)
    const next = [...order]
    for (let i = next.length - 1; i > 0; i--) {
      const j = (i * 7 + pos + 3) % (i + 1)
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setOrder(next)
    setPos(0)
    setFlipped(false)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between text-xs text-slate-400">
        <span>
          Card <span className="font-semibold text-white">{pos + 1}</span> / {cards.length}
        </span>
        <button onClick={shuffle} className="btn-ghost px-2.5 py-1.5 text-xs">
          <Shuffle size={13} /> Shuffle
        </button>
      </div>

      <div
        className="relative h-72 w-full cursor-pointer select-none"
        style={{ perspective: 1200 }}
        onClick={() => setFlipped((f) => !f)}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* front */}
          <div
            className="glass-strong absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {card.concept && (
              <span className="rounded-full border border-neon-purple/30 bg-neon-purple/10 px-3 py-1 text-[11px] font-medium text-neon-purple">
                {card.concept}
              </span>
            )}
            <p className="text-xl font-medium text-white">{card.front}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <RotateCw size={12} /> click to flip
            </span>
          </div>

          {/* back */}
          <div
            className="glass-strong absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-base leading-relaxed text-slate-100">{card.back}</p>
            {card.source && (
              <span className="mt-2 text-[11px] text-neon-cyan">source: {card.source}</span>
            )}
          </div>
        </motion.div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => go(-1)} className="btn-ghost">
          <ChevronLeft size={16} /> Prev
        </button>
        <button onClick={() => setFlipped((f) => !f)} className="btn-primary">
          <RotateCw size={15} /> Flip
        </button>
        <button onClick={() => go(1)} className="btn-ghost">
          Next <ChevronRight size={16} />
        </button>
      </div>

      <AnimatePresence>
        <motion.div
          key={pos}
          initial={{ width: 0 }}
          animate={{ width: `${((pos + 1) / cards.length) * 100}%` }}
          className="mt-5 h-1 rounded-full bg-gradient-to-r from-neon-purple to-neon-cyan"
        />
      </AnimatePresence>
    </div>
  )
}
