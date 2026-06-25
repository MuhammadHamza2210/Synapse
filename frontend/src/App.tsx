import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useRealtime } from '@/hooks/useRealtime'
import { useAuthStore } from '@/store/authStore'
import Dashboard from '@/pages/Dashboard'
import Palace from '@/pages/Palace'
import Library from '@/pages/Library'
import Chat from '@/pages/Chat'
import Study from '@/pages/Study'
import Path from '@/pages/Path'

export default function App() {
  useRealtime()
  const hydrate = useAuthStore((s) => s.hydrate)
  const location = useLocation()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/palace" element={<Palace />} />
          <Route path="/path" element={<Path />} />
          <Route path="/study" element={<Study />} />
          <Route path="/library" element={<Library />} />
          <Route path="/chat" element={<Chat />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  )
}
