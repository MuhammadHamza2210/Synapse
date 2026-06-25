import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, RotateCcw, Trophy, X } from 'lucide-react'
import clsx from 'clsx'
import type { QuizQuestion } from '@/types'

const LETTERS = ['A', 'B', 'C', 'D']

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    setIdx(0)
    setSelected(null)
    setScore(0)
    setFinished(false)
  }, [questions])

  if (!questions.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No quiz questions for this topic yet.</p>
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      >
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-neon-purple to-neon-cyan shadow-glow">
          <Trophy size={34} className="text-white" />
        </div>
        <div>
          <p className="text-3xl font-semibold text-white">
            {score} / {questions.length}
          </p>
          <p className="text-sm text-slate-400">
            {pct >= 80 ? 'Mastered! 🎉' : pct >= 50 ? 'Good progress — review and retry.' : 'Keep studying — you’ll get it.'}
          </p>
        </div>
        <button
          onClick={() => {
            setIdx(0)
            setSelected(null)
            setScore(0)
            setFinished(false)
          }}
          className="btn-primary"
        >
          <RotateCcw size={15} /> Retake quiz
        </button>
      </motion.div>
    )
  }

  const q = questions[idx]
  const answered = selected !== null

  function choose(i: number) {
    if (answered) return
    setSelected(i)
    if (i === q.answer_index) setScore((s) => s + 1)
  }

  function next() {
    if (idx + 1 >= questions.length) {
      setFinished(true)
    } else {
      setIdx((i) => i + 1)
      setSelected(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          Question <span className="font-semibold text-white">{idx + 1}</span> / {questions.length}
        </span>
        <span className="rounded-full bg-white/5 px-2.5 py-1">Score {score}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <p className="mb-5 text-lg font-medium leading-relaxed text-white">{q.question}</p>

          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.answer_index
              const isPicked = i === selected
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={answered}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all',
                    !answered && 'border-white/10 bg-white/5 hover:border-neon-cyan/40 hover:bg-white/10',
                    answered && isCorrect && 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
                    answered && isPicked && !isCorrect && 'border-rose-400/50 bg-rose-400/10 text-rose-200',
                    answered && !isCorrect && !isPicked && 'border-white/5 bg-white/5 opacity-60',
                  )}
                >
                  <span
                    className={clsx(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold',
                      answered && isCorrect
                        ? 'bg-emerald-400/20 text-emerald-300'
                        : answered && isPicked
                          ? 'bg-rose-400/20 text-rose-300'
                          : 'bg-white/10 text-slate-300',
                    )}
                  >
                    {answered && isCorrect ? (
                      <Check size={14} />
                    ) : answered && isPicked ? (
                      <X size={14} />
                    ) : (
                      LETTERS[i]
                    )}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>

          {answered && q.explanation && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300"
            >
              {q.explanation}
            </motion.div>
          )}

          {answered && (
            <div className="mt-5 flex justify-end">
              <button onClick={next} className="btn-primary">
                {idx + 1 >= questions.length ? 'See results' : 'Next question'}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
