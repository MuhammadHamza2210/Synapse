import { create } from 'zustand'

interface SynapseState {
  /** Concept ids the tutor just cited — these pulse in the 3D Mind Palace. */
  pulsedConceptIds: number[]
  pulseStamp: number
  /** Concept currently hovered/selected in the graph. */
  activeConceptId: number | null

  setPulsed: (ids: number[]) => void
  clearPulsed: () => void
  setActiveConcept: (id: number | null) => void
}

export const useStore = create<SynapseState>((set) => ({
  pulsedConceptIds: [],
  pulseStamp: 0,
  activeConceptId: null,

  setPulsed: (ids) => set({ pulsedConceptIds: ids, pulseStamp: Date.now() }),
  clearPulsed: () => set({ pulsedConceptIds: [] }),
  setActiveConcept: (id) => set({ activeConceptId: id }),
}))
