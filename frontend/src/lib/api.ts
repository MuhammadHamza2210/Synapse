import axios from 'axios'
import type {
  AuthUser,
  ChatAnswer,
  Cluster,
  Document,
  GraphData,
  Health,
  LearningPath,
  StudySet,
  TokenResponse,
} from '@/types'

export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

// NOTE: we deliberately do NOT set a default Content-Type. Axios sets
// application/json automatically for object bodies, and for FormData it lets the
// browser set multipart/form-data *with the boundary* — forcing the header here
// would strip the boundary and break file uploads.
export const http = axios.create({
  baseURL: API_BASE,
})

// --- auth token shared by axios + fetch (set by the auth store) ---------------
let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

http.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`
  return config
})

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {}
}

export interface StreamHandlers {
  onMeta?: (m: { session_id: number; citations: any[]; concept_ids: number[] }) => void
  onToken?: (text: string) => void
  onDone?: (d: { mode: string; session_id: number }) => void
  onError?: (detail?: string) => void
}

export const api = {
  health: () => http.get<Health>('/health').then((r) => r.data),

  listDocuments: () =>
    http.get<Document[]>('/api/documents').then((r) => r.data),

  getDocument: (id: number) =>
    http.get<Document>(`/api/documents/${id}`).then((r) => r.data),

  pasteDocument: (title: string, text: string) =>
    http
      .post<Document>('/api/documents/paste', { title, text })
      .then((r) => r.data),

  uploadDocument: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return http
      .post<Document>('/api/documents/upload', form, {
        // no Content-Type here — the browser adds multipart/form-data + boundary
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      .then((r) => r.data)
  },

  deleteDocument: (id: number) =>
    http.delete(`/api/documents/${id}`).then((r) => r.data),

  getGraph: (limit = 150) =>
    http.get<GraphData>(`/api/graph?limit=${limit}`).then((r) => r.data),

  getClusters: () =>
    http.get<Cluster[]>('/api/study/clusters').then((r) => r.data),

  getStudy: (clusterId: number, count = 8) =>
    http
      .get<StudySet>(`/api/study/clusters/${clusterId}?count=${count}`)
      .then((r) => r.data),

  getLearningPath: () =>
    http.get<LearningPath>('/api/path').then((r) => r.data),

  query: (question: string, sessionId?: number, documentIds?: number[]) =>
    http
      .post<ChatAnswer>('/api/chat/query', {
        question,
        session_id: sessionId ?? null,
        document_ids: documentIds ?? null,
      })
      .then((r) => r.data),

  // --- auth ---
  register: (email: string, password: string) =>
    http.post<TokenResponse>('/api/auth/register', { email, password }).then((r) => r.data),

  login: (email: string, password: string) =>
    http.post<TokenResponse>('/api/auth/login', { email, password }).then((r) => r.data),

  me: () => http.get<AuthUser>('/api/auth/me').then((r) => r.data),

  // --- progress (auth required) ---
  getProgress: () =>
    http.get<{ keys: string[] }>('/api/progress').then((r) => r.data.keys),

  putProgress: (keys: string[]) =>
    http.put<{ keys: string[] }>('/api/progress', { keys }).then((r) => r.data.keys),
}

/** Stream a RAG answer via SSE over fetch (supports POST bodies, unlike EventSource). */
export async function streamQuery(
  question: string,
  sessionId: number | undefined,
  handlers: StreamHandlers,
): Promise<void> {
  let resp: Response
  try {
    resp = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ question, session_id: sessionId ?? null, document_ids: null }),
    })
  } catch {
    handlers.onError?.('network')
    return
  }
  if (!resp.ok || !resp.body) {
    handlers.onError?.(`http ${resp.status}`)
    return
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, sep).trim()
      buffer = buffer.slice(sep + 2)
      if (!rawEvent.startsWith('data:')) continue
      let data: any
      try {
        data = JSON.parse(rawEvent.slice(5).trim())
      } catch {
        continue
      }
      if (data.type === 'meta') handlers.onMeta?.(data)
      else if (data.type === 'token') handlers.onToken?.(data.text)
      else if (data.type === 'done') handlers.onDone?.(data)
      else if (data.type === 'error') handlers.onError?.(data.detail)
    }
  }
}

export const wsUrl = () => API_BASE.replace(/^http/, 'ws') + '/ws'
