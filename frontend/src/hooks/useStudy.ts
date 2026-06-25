import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useClusters() {
  return useQuery({ queryKey: ['clusters'], queryFn: api.getClusters })
}

export function useStudySet(clusterId: number | null, count = 8) {
  return useQuery({
    queryKey: ['study', clusterId, count],
    queryFn: () => api.getStudy(clusterId as number, count),
    enabled: clusterId != null,
  })
}

export function useLearningPath() {
  return useQuery({ queryKey: ['path'], queryFn: api.getLearningPath })
}
