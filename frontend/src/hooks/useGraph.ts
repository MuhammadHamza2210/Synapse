import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useGraph(limit = 150) {
  return useQuery({
    queryKey: ['graph', limit],
    queryFn: () => api.getGraph(limit),
  })
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: api.health })
}
