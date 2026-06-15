import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import { Icon } from './lib/icons'
import LoginScreen from './screens/LoginScreen'
import DirectoryScreen from './screens/DirectoryScreen'
import ChatScreen from './screens/ChatScreen'
import ReviewScreen from './screens/ReviewScreen'

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-cool)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--teal-700)' }}>
        <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}>
          <Icon name="spinner" size={22} color="var(--teal-700)" />
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-500)' }}>Loading the hub…</span>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )
}

export default function App() {
  const { session, profile, loading } = useAuth()

  const [screen, setScreen] = useState('directory') // directory | chat | review
  const [agentId, setAgentId] = useState(null)
  const [agents, setAgents] = useState([])
  const [reviewCount, setReviewCount] = useState(0)

  // Load the agent catalog + pending review count once the member is in.
  const loadCatalog = useCallback(async () => {
    const [{ data: agentRows }, { count }] = await Promise.all([
      supabase.from('agents').select('*').order('sort_order'),
      supabase.from('review_items').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setAgents(agentRows ?? [])
    setReviewCount(count ?? 0)
  }, [])

  useEffect(() => {
    if (session) loadCatalog()
  }, [session, loadCatalog])

  // Which agents is this member cleared for? (UI mirror of the DB policy.)
  const clearances = profile?.clearances ?? []
  const canAccess = useCallback(
    (agent) =>
      agent.status === 'active' &&
      (agent.required_clearance === 'all' || clearances.includes(agent.required_clearance)),
    [clearances]
  )

  const openAgent = useCallback((id) => {
    setAgentId(id)
    setScreen('chat')
    window.scrollTo(0, 0)
  }, [])

  const goDirectory = useCallback(() => { setScreen('directory'); window.scrollTo(0, 0) }, [])
  const openReview = useCallback(() => {
    try { window.speechSynthesis?.cancel() } catch { /* noop */ }
    setScreen('review'); window.scrollTo(0, 0)
  }, [])

  const currentAgent = useMemo(
    () => agents.find((a) => a.id === agentId) || null,
    [agents, agentId]
  )

  if (loading) return <Splash />
  if (!session) return <LoginScreen />

  // Profile may lag a beat behind the session on first sign-in.
  if (!profile) return <Splash />

  if (screen === 'chat' && currentAgent) {
    return (
      <ChatScreen
        agent={currentAgent}
        profile={profile}
        agents={agents}
        onBack={goDirectory}
        onReviewChanged={loadCatalog}
      />
    )
  }

  if (screen === 'review') {
    return (
      <ReviewScreen
        profile={profile}
        onBack={goDirectory}
        onCountChange={setReviewCount}
      />
    )
  }

  return (
    <DirectoryScreen
      profile={profile}
      agents={agents}
      canAccess={canAccess}
      reviewCount={reviewCount}
      onOpenAgent={openAgent}
      onOpenReview={openReview}
    />
  )
}
