import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import { buildSimulation, stepSimulation, type SimNode } from './forceLayout'
import { useStore } from '@/store/useStore'
import type { GraphData } from '@/types'

const PULSE_DECAY = 2.4 // seconds for a pulse to fade

function Scene({ data }: { data: GraphData }) {
  const { simNodes, simEdges, indexById } = useMemo(
    () => buildSimulation(data.nodes, data.links),
    [data],
  )

  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const sphereRefs = useRef<(THREE.Mesh | null)[]>([])
  const linesRef = useRef<THREE.LineSegments>(null)
  const intensities = useRef<Float32Array>(new Float32Array(simNodes.length))
  const [hovered, setHovered] = useState<number | null>(null)

  const pulseStamp = useStore((s) => s.pulseStamp)
  const pulsedIds = useStore((s) => s.pulsedConceptIds)
  const setActiveConcept = useStore((s) => s.setActiveConcept)
  const lastStamp = useRef(0)

  // top-salience nodes always show a label; the rest reveal on hover
  const topLabels = useMemo(() => {
    const order = [...data.nodes]
      .map((n, i) => ({ i, s: n.salience }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 16)
    return new Set(order.map((o) => o.i))
  }, [data])

  // edge buffers
  const { positions, colors } = useMemo(() => {
    return {
      positions: new Float32Array(simEdges.length * 6),
      colors: new Float32Array(simEdges.length * 6),
    }
  }, [simEdges.length])

  // trigger pulse when the tutor cites concepts
  useEffect(() => {
    if (pulseStamp === lastStamp.current) return
    lastStamp.current = pulseStamp
    const set = new Set(pulsedIds)
    simNodes.forEach((n, i) => {
      if (set.has(n.id)) intensities.current[i] = 1
    })
  }, [pulseStamp, pulsedIds, simNodes])

  const white = useMemo(() => new THREE.Color('#ffffff'), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    stepSimulation(simNodes, simEdges, dt)

    // nodes
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i]
      const group = groupRefs.current[i]
      const sphere = sphereRefs.current[i]
      if (intensities.current[i] > 0) {
        intensities.current[i] = Math.max(0, intensities.current[i] - dt / PULSE_DECAY)
      }
      const pulse = intensities.current[i]
      const isHover = hovered === i
      if (group) group.position.copy(n.pos)
      if (sphere) {
        const scale = n.radius * (1 + pulse * 0.9 + (isHover ? 0.25 : 0))
        sphere.scale.setScalar(scale)
        const mat = sphere.material as THREE.MeshStandardMaterial
        tmp.copy(n.baseColor).lerp(white, pulse * 0.6)
        mat.color.copy(tmp)
        mat.emissive.copy(tmp)
        mat.emissiveIntensity = 0.35 + pulse * 2.2 + (isHover ? 0.4 : 0)
      }
    }

    // edges
    const lines = linesRef.current
    if (lines) {
      const posAttr = lines.geometry.getAttribute('position') as THREE.BufferAttribute
      const colAttr = lines.geometry.getAttribute('color') as THREE.BufferAttribute
      for (let e = 0; e < simEdges.length; e++) {
        const a = simNodes[simEdges[e].a]
        const b = simNodes[simEdges[e].b]
        const o = e * 6
        posAttr.array[o] = a.pos.x
        posAttr.array[o + 1] = a.pos.y
        posAttr.array[o + 2] = a.pos.z
        posAttr.array[o + 3] = b.pos.x
        posAttr.array[o + 4] = b.pos.y
        posAttr.array[o + 5] = b.pos.z
        const glow = Math.max(intensities.current[simEdges[e].a], intensities.current[simEdges[e].b])
        const base = 0.12 + glow * 0.8
        colAttr.array[o] = 0.4 + glow * 0.6
        colAttr.array[o + 1] = 0.5 + glow * 0.4
        colAttr.array[o + 2] = 0.9
        colAttr.array[o + 3] = 0.4 + glow * 0.6
        colAttr.array[o + 4] = 0.5 + glow * 0.4
        colAttr.array[o + 5] = 0.9
        // fade by writing alpha through material opacity isn't per-vertex; approximate via color scale
        colAttr.array[o] *= base + 0.3
        colAttr.array[o + 3] *= base + 0.3
      }
      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={120} color="#a855f7" />
      <pointLight position={[-12, -8, -6]} intensity={90} color="#22d3ee" />
      <Stars radius={80} depth={40} count={2500} factor={4} saturation={0} fade speed={0.5} />

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.55} />
      </lineSegments>

      {simNodes.map((n: SimNode, i) => (
        <group key={n.id} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh
            ref={(el) => (sphereRefs.current[i] = el)}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHovered(i)
              setActiveConcept(n.id)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHovered(null)
              setActiveConcept(null)
              document.body.style.cursor = 'auto'
            }}
          >
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial
              color={n.baseColor}
              emissive={n.baseColor}
              emissiveIntensity={0.4}
              roughness={0.35}
              metalness={0.1}
            />
          </mesh>
          {(topLabels.has(i) || hovered === i) && (
            <Billboard position={[0, n.radius + 0.55, 0]}>
              <Text
                fontSize={0.42}
                color={hovered === i ? '#ffffff' : '#cbd5e1'}
                anchorX="center"
                anchorY="bottom"
                outlineWidth={0.012}
                outlineColor="#05060f"
                maxWidth={6}
              >
                {data.nodes[i].label}
              </Text>
            </Billboard>
          )}
        </group>
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={0.45}
        minDistance={6}
        maxDistance={40}
      />
    </>
  )
}

export function MindPalace({ data }: { data: GraphData }) {
  if (!data.nodes.length) return null
  return (
    <Canvas
      camera={{ position: [0, 0, 22], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <Scene data={data} />
    </Canvas>
  )
}
