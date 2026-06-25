import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Document } from '@/types'

export function useDocuments() {
  const qc = useQueryClient()
  const prevProcessing = useRef(0)

  const query = useQuery({
    queryKey: ['documents'],
    queryFn: api.listDocuments,
    // keep polling while anything is still being processed in the background
    refetchInterval: (q) => {
      const data = q.state.data as Document[] | undefined
      return data?.some((d) => d.status === 'processing') ? 1500 : false
    },
  })

  // when the last processing document finishes, refresh everything it feeds
  useEffect(() => {
    const processing = query.data?.filter((d) => d.status === 'processing').length ?? 0
    if (prevProcessing.current > 0 && processing === 0) {
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['clusters'] })
      qc.invalidateQueries({ queryKey: ['path'] })
    }
    prevProcessing.current = processing
  }, [query.data, qc])

  return query
}

function useInvalidateKnowledge() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['documents'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['clusters'] })
    qc.invalidateQueries({ queryKey: ['path'] })
  }
}

export function useUploadDocument(onProgress?: (pct: number) => void) {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: (file: File) => api.uploadDocument(file, onProgress),
    onSuccess: invalidate,
  })
}

export function usePasteDocument() {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: ({ title, text }: { title: string; text: string }) =>
      api.pasteDocument(title, text),
    onSuccess: invalidate,
  })
}

export function useDeleteDocument() {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: (id: number) => api.deleteDocument(id),
    onSuccess: invalidate,
  })
}
