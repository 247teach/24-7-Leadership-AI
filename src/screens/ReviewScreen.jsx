import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from '../lib/icons'

const teal = '#1d6e73'

function formatWhen(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`
  return d.toLocaleDateString(undefined, { weekday: 'short' }) + `, ${time}`
}

export default function ReviewScreen({ profile, onBack, onCountChange }) {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const list = data ?? []
    setItems(list)
    setLoaded(true)
    onCountChange?.(list.length)
  }, [onCountChange])

  useEffect(() => { load() }, [load])

  const resolve = useCallback(async (item, status) => {
    setItems((cur) => {
      const next = cur.filter((r) => r.id !== item.id)
      onCountChange?.(next.length)
      return next
    })
    await supabase
      .from('review_items')
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: profile.id })
      .eq('id', item.id)
  }, [profile.id, onCountChange])

  return (
    <div style={{ minHeight: '100vh', background: '#e6ecf0', animation: 'fadeIn .4s ease' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e0e6ee', padding: '0 40px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 5 }}>
        <img src="/assets/logo.png" alt="24/7 Education" style={{ height: 40, width: 'auto', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button className="btn-ghost" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: '#63697a', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Icon name="back" size={16} />Back to hub
          </button>
          <span style={{ width: 1, height: 30, background: '#e2e8ef' }} />
          <div className="hub-header-id" style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#30455c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>{profile.initials}</div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#27384a' }}>{profile.full_name}</div>
              <div style={{ fontSize: 12, color: '#76808f' }}>{profile.role}</div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '52px 40px 84px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: teal }}>Governance</div>
        <h1 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 40", fontSize: 36, letterSpacing: '-.015em', color: '#10243E', margin: '12px 0 0' }}>Knowledge review</h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: '#5a6573', margin: '12px 0 0', maxWidth: 600 }}>Human Led, AI Facilitated. Uploads and corrections wait here until a person reviews them. Nothing enters the governed knowledge base without approval.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '30px 0 16px', fontSize: 13, fontWeight: 600, color: '#63697a' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e8886a', display: 'inline-block' }} />{items.length} awaiting review
        </div>

        {items.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {items.map((item) => {
              const isDoc = item.type === 'document'
              return (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #dde4ec', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 1px 2px rgba(16,36,62,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 15 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: isDoc ? '#e3f4f4' : '#fbe9e3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={isDoc ? 'filetext' : 'flag'} size={18} color={isDoc ? teal : '#b3603f'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: isDoc ? '#176b70' : '#b3603f', background: isDoc ? '#e3f4f4' : '#fbe9e3', border: `1px solid ${isDoc ? '#c4e6e7' : '#f1cdbf'}`, padding: '4px 10px', borderRadius: 999 }}>{isDoc ? 'Document' : 'Correction'}</span>
                        <span style={{ fontSize: 12.5, color: '#9aa3b2' }}>{formatWhen(item.created_at)}</span>
                      </div>
                      <h3 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 26", fontSize: 19, letterSpacing: '-.01em', color: '#16293f', margin: '9px 0 4px' }}>{item.title}</h3>
                      <div style={{ fontSize: 13, color: '#76808f' }}>Submitted by {item.submitted_name || 'a team member'} · {item.source}</div>
                    </div>
                  </div>
                  {item.snippet && <div style={{ background: '#f4f7f9', border: '1px solid #e6ecf1', borderRadius: 10, padding: '14px 16px', fontSize: 14.5, lineHeight: 1.55, color: '#46566a' }}>{item.snippet}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#76808f' }}>
                      Would feed<span style={{ fontWeight: 600, color: '#3c4a5c', background: '#eef2f6', border: '1px solid #e2e8ef', padding: '4px 10px', borderRadius: 999 }}>{item.target}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button className="btn-decline" onClick={() => resolve(item, 'declined')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #d8e0e8', borderRadius: 999, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, color: '#63697a' }}><Icon name="x" size={14} />Decline</button>
                      <button className="btn-primary" onClick={() => resolve(item, 'approved')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: teal, border: 'none', borderRadius: 999, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, color: '#fff' }}><Icon name="check" size={15} color="#fff" />Approve</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : loaded ? (
          <div style={{ background: '#fff', border: '1px solid #dde4ec', borderRadius: 14, padding: '56px 32px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#e3f4f4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: teal, marginBottom: 16 }}>
              <Icon name="clipboard" size={26} color={teal} />
            </div>
            <h3 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 26", fontSize: 20, color: '#16293f', margin: '0 0 6px' }}>All caught up</h3>
            <p style={{ fontSize: 14.5, color: '#76808f', margin: 0 }}>Nothing is waiting for review right now.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
