import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardPaste, FileUp, Loader2, UploadCloud } from 'lucide-react'
import clsx from 'clsx'
import { usePasteDocument, useUploadDocument } from '@/hooks/useDocuments'

type Tab = 'file' | 'paste'

export function UploadPanel() {
  const [tab, setTab] = useState<Tab>('file')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useUploadDocument(setProgress)
  const paste = usePasteDocument()

  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      setProgress(0)
      await upload.mutateAsync(file).catch(() => null)
    }
    setProgress(0)
  }

  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
        <button
          onClick={() => setTab('file')}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors',
            tab === 'file' ? 'bg-white/10 text-white' : 'text-slate-400',
          )}
        >
          <FileUp size={14} /> Upload file
        </button>
        <button
          onClick={() => setTab('paste')}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors',
            tab === 'paste' ? 'bg-white/10 text-white' : 'text-slate-400',
          )}
        >
          <ClipboardPaste size={14} /> Paste text
        </button>
      </div>

      {tab === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInput.current?.click()}
          className={clsx(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/15 hover:border-white/30',
          )}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv,.json,.py,.js,.ts"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {upload.isPending ? (
            <Loader2 className="animate-spin text-neon-cyan" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-neon-purple to-neon-cyan shadow-glow">
              <UploadCloud className="text-white" />
            </div>
          )}
          <div>
            <p className="font-medium text-white">Drop a document here</p>
            <p className="text-xs text-slate-400">PDF, TXT, MD, code — it gets chunked, embedded & mapped</p>
          </div>
          {upload.isPending && (
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan"
                animate={{ width: `${progress}%` }}
              />
            </div>
          )}
          {upload.isError && (
            <p className="text-xs text-rose-400">Upload failed — check the file and backend.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your notes, an article, a transcript…"
            rows={7}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
          />
          <button
            disabled={paste.isPending || !title.trim() || !text.trim()}
            onClick={async () => {
              await paste.mutateAsync({ title, text }).catch(() => null)
              setTitle('')
              setText('')
            }}
            className="btn-primary w-full"
          >
            {paste.isPending ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
            Add to knowledge base
          </button>
        </div>
      )}
    </div>
  )
}
