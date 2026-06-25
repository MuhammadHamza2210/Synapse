import * as THREE from 'three'
import type { GraphLink, GraphNode } from '@/types'

export interface SimNode {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  radius: number
  color: THREE.Color
  baseColor: THREE.Color
}

export interface SimEdge {
  a: number // index into nodes
  b: number
  weight: number
}

const PALETTE = ['#a855f7', '#7c5cff', '#22d3ee', '#3b82f6', '#f472b6', '#34d399', '#fbbf24']

/** Deterministic point on a sphere so the initial layout looks intentional, not random. */
function spherePoint(i: number, n: number, r: number): THREE.Vector3 {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (i / Math.max(1, n - 1)) * 2
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = golden * i
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).multiplyScalar(r)
}

export function buildSimulation(nodes: GraphNode[], links: GraphLink[]) {
  const maxSal = Math.max(1, ...nodes.map((n) => n.salience))
  const indexById = new Map<number, number>()
  nodes.forEach((n, i) => indexById.set(n.id, i))

  const simNodes: SimNode[] = nodes.map((n, i) => {
    const color = new THREE.Color(PALETTE[n.id % PALETTE.length])
    return {
      id: n.id,
      pos: spherePoint(i, nodes.length, 9),
      vel: new THREE.Vector3(),
      radius: 0.22 + (n.salience / maxSal) * 0.7,
      color: color.clone(),
      baseColor: color,
    }
  })

  const simEdges: SimEdge[] = links
    .map((l) => ({
      a: indexById.get(l.source) ?? -1,
      b: indexById.get(l.target) ?? -1,
      weight: l.weight,
    }))
    .filter((e) => e.a >= 0 && e.b >= 0)

  return { simNodes, simEdges, indexById }
}

const REPULSION = 5.5
const SPRING = 0.02
const SPRING_LENGTH = 3.2
const CENTER_PULL = 0.012
const DAMPING = 0.86
const MAX_SPEED = 0.6

const _diff = new THREE.Vector3()

/** One step of a simple force-directed integration. Mutates node positions in place. */
export function stepSimulation(nodes: SimNode[], edges: SimEdge[], dt: number) {
  const n = nodes.length
  // pairwise repulsion
  for (let i = 0; i < n; i++) {
    const ni = nodes[i]
    for (let j = i + 1; j < n; j++) {
      const nj = nodes[j]
      _diff.subVectors(ni.pos, nj.pos)
      let d2 = _diff.lengthSq()
      if (d2 < 0.01) {
        _diff.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        d2 = 0.01
      }
      const force = REPULSION / d2
      _diff.normalize().multiplyScalar(force)
      ni.vel.addScaledVector(_diff, dt)
      nj.vel.addScaledVector(_diff, -dt)
    }
  }

  // spring attraction along edges
  for (const e of edges) {
    const a = nodes[e.a]
    const b = nodes[e.b]
    _diff.subVectors(b.pos, a.pos)
    const dist = _diff.length() || 0.001
    const target = SPRING_LENGTH + a.radius + b.radius
    const force = (dist - target) * SPRING * Math.min(2, 0.5 + e.weight * 0.2)
    _diff.normalize().multiplyScalar(force)
    a.vel.addScaledVector(_diff, dt * 60)
    b.vel.addScaledVector(_diff, -dt * 60)
  }

  // centering + integrate
  for (const node of nodes) {
    _diff.copy(node.pos).multiplyScalar(-CENTER_PULL)
    node.vel.add(_diff)
    node.vel.multiplyScalar(DAMPING)
    if (node.vel.length() > MAX_SPEED) node.vel.setLength(MAX_SPEED)
    node.pos.addScaledVector(node.vel, dt * 60)
  }
}
