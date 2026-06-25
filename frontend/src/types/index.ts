export interface Capabilities {
  llm: string
  model: string | null
  embeddings: string
  vector_store: string
}

export interface Health {
  status: string
  app: string
  version: string
  capabilities: Capabilities
}

export interface Document {
  id: number
  title: string
  filename: string | null
  source_type: string
  char_count: number
  chunk_count: number
  status: string
  created_at: string | null
  preview?: string
}

export interface GraphNode {
  id: number
  label: string
  salience: number
  mentions: number
  doc_count: number
  category: string | null
}

export interface GraphLink {
  id: number
  source: number
  target: number
  weight: number
  kind: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  stats: { concepts: number; edges: number }
}

export interface Citation {
  marker: number
  chunk_id: number
  document_id: number
  document_title: string | null
  page: number | null
  snippet: string
  score: number
}

export interface ChatAnswer {
  session_id: number
  answer: string
  citations: Citation[]
  concept_ids: number[]
  mode: string
}

export interface ChatMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  concept_ids?: number[]
  pending?: boolean
  mode?: string
}

export interface Cluster {
  id: number
  title: string
  size: number
  concept_ids: number[]
  concepts: string[]
  salience: number
}

export interface Flashcard {
  front: string
  back: string
  concept?: string
  source?: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer_index: number
  explanation?: string
  concept?: string
}

export interface StudySet {
  cluster: { id: number; title: string; concepts: string[] }
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  mode: string
}

export interface PathStep {
  label: string
  hint: string | null
  source: string
}

export interface PathModule {
  cluster_id: number
  title: string
  order: number
  concept_count: number
  rationale: string
  steps: PathStep[]
}

export interface LearningPath {
  modules: PathModule[]
  total_modules: number
  total_steps: number
}

export interface AuthUser {
  id: number
  email: string
  created_at: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: AuthUser
}
