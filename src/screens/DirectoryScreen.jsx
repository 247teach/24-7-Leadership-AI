import { useAuth } from '../context/AuthContext'
import { Icon } from '../lib/icons'

const teal = '#1d6e73'

function HubHeader({ profile, reviewCount, onOpenReview, onSignOut }) {
  return (
    <header style={{ background: '#fff', borderBottom: '1px solid #e0e6ee', padding: '0 40px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 5 }}>
      <img src="/assets/logo.png" alt="24/7 Education" style={{ height: 40, width: 'auto', display: 'block' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <button className="btn-review" onClick={onOpenReview}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #d8e0e8', borderRadius: 999, padding: '8px 14px', color: '#3c4a5c', fontSize: 13, fontWeight: 600 }}>
          <Icon name="clipboard" size={17} />Knowledge review
          <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: teal, color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{reviewCount}</span>
        </button>
        <span style={{ width: 1, height: 30, background: '#e2e8ef' }} />
        <div className="hub-header-id" style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#30455c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>{profile.initials}</div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#27384a' }}>{profile.full_name}</div>
            <div style={{ fontSize: 12, color: '#76808f' }}>{profile.role}</div>
          </div>
        </div>
        <span style={{ width: 1, height: 30, background: '#e2e8ef' }} />
        <button className="btn-ghost" onClick={onSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: '#63697a', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <Icon name="logout" size={17} />Sign out
        </button>
      </div>
    </header>
  )
}

export default function DirectoryScreen({ profile, agents, canAccess, reviewCount, onOpenAgent, onOpenReview }) {
  const { signOut } = useAuth()

  const flagship = agents.find((a) => a.is_flagship && canAccess(a))
  const specialists = agents.filter((a) => !a.is_flagship && a.status === 'active' && canAccess(a))
  const locked = agents.filter((a) => !a.is_flagship && !(a.status === 'active' && canAccess(a)))

  return (
    <div style={{ minHeight: '100vh', background: '#e6ecf0', animation: 'fadeIn .4s ease' }}>
      <HubHeader profile={profile} reviewCount={reviewCount} onOpenReview={onOpenReview} onSignOut={signOut} />

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '52px 40px 84px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: teal }}>Agent Hub</div>
        <h1 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 40", fontSize: 36, letterSpacing: '-.015em', color: '#10243E', margin: '12px 0 0' }}>Your agents</h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: '#5a6573', margin: '12px 0 0', maxWidth: 560 }}>A working set of AI agents for the 24/7 Education team. Access expands with your role and clearance.</p>

        {flagship && (
          <div className="card-flagship" onClick={() => onOpenAgent(flagship.id)}
            style={{ marginTop: 36, background: '#10243E', borderRadius: 18, padding: '38px 40px', display: 'flex', gap: 34, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer', boxShadow: '0 18px 40px -18px rgba(16,36,62,.5)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(7,196,200,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07c4c8', flexShrink: 0 }}>
              <Icon name={flagship.icon} size={30} color="#07c4c8" />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#07c4c8' }}>
                Flagship Assistant
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#9fb0c4', letterSpacing: '.04em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5fd6a8', display: 'inline-block' }} />Active
                </span>
              </div>
              <h2 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 36", fontSize: 28, letterSpacing: '-.01em', color: '#fff', margin: '9px 0 0' }}>{flagship.name}</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: '#aab8c9', margin: '9px 0 0', maxWidth: 560 }}>{flagship.description}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onOpenAgent(flagship.id) }}
              style={{ background: '#07c4c8', color: '#0b2440', border: 'none', borderRadius: 999, padding: '14px 24px', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              Open {flagship.name}<Icon name="arrow" size={17} color="#0b2440" />
            </button>
          </div>
        )}

        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: teal, margin: '48px 0 18px' }}>Specialist Agents</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 22 }}>
          {specialists.map((a) => (
            <div key={a.id} className="card-agent" onClick={() => onOpenAgent(a.id)}
              style={{ background: '#fff', border: '1px solid #dde4ec', borderRadius: 14, padding: 26, display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer', minHeight: 236 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: 50, height: 50, borderRadius: 13, background: '#e3f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: teal }}>
                  <Icon name={a.icon} size={26} color={teal} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#5a6573', background: '#eef2f6', border: '1px solid #e2e8ef', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{a.clearance_label}</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 28", fontSize: 21, letterSpacing: '-.01em', color: '#16293f', margin: '0 0 8px' }}>{a.name}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.5, color: '#5a6573', margin: 0 }}>{a.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #eef2f6', paddingTop: 16 }}>
                <span style={{ fontSize: 12.5, color: '#8a93a2' }}>{a.function_label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: teal, color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 600 }}>
                  Open<Icon name="chevron" size={15} color="#fff" />
                </span>
              </div>
            </div>
          ))}
        </div>

        {locked.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8a93a2', margin: '48px 0 6px' }}>Expanding Access</div>
            <p style={{ fontSize: 14, color: '#8a93a2', margin: '0 0 18px', maxWidth: 560 }}>These agents exist but are not open to your role yet. The hub grows as access expands.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 22 }}>
              {locked.map((a) => {
                const restricted = a.status !== 'coming_soon'
                const statusText = a.status === 'coming_soon' ? 'Coming soon' : 'Requires higher clearance'
                return (
                  <div key={a.id} style={{ background: '#eef1f5', border: '1px solid #dfe4ea', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, opacity: .92 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: '#e1e6ec', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b2' }}>
                        <Icon name={a.icon} size={22} color="#9aa3b2" />
                      </div>
                      <span style={{ color: '#9aa3b2' }}><Icon name="lock" size={18} color="#aab2bf" /></span>
                    </div>
                    <div>
                      <h3 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 28", fontSize: 19, letterSpacing: '-.01em', color: '#6a7484', margin: '0 0 6px' }}>{a.name}</h3>
                      <p style={{ fontSize: 14, lineHeight: 1.5, color: '#9098a6', margin: 0 }}>{a.description}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: restricted ? '#b3603f' : '#9098a6' }}>{statusText}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 60, paddingTop: 26, borderTop: '1px solid #d9e0e8', fontSize: 13, color: '#8a93a2' }}>Human Led, AI Facilitated. Every agent reads only the knowledge your role is cleared to see.</div>
      </div>
    </div>
  )
}
