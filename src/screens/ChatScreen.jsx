import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon, formatSize } from '../lib/icons'
import { generateAgentReply } from '../lib/agentReply'
import { useTextToSpeech, useSpeechToText } from '../hooks/useSpeech'

const teal = '#1d6e73'

function formatRelative(iso) {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ChatScreen({ agent, profile, onBack, onReviewChanged }) {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [attachments, setAttachments] = useState([]) // pending: {id, name, size, storage_path}
  const [copiedId, setCopiedId] = useState(null)

  const threadRef = useRef(null)
  const fileInputRef = useRef(null)

  const tts = useTextToSpeech()
  const stt = useSpeechToText((text) =>
    setDraft((d) => (d ? d + ' ' + text : text))
  )

  // ---- Load messages (+ their attachments) for a conversation ----------
  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) { setMessages([]); return }
    const [{ data: msgs }, { data: files }] = await Promise.all([
      supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at'),
      supabase.from('attachments').select('*').eq('conversation_id', conversationId).not('message_id', 'is', null),
    ])
    const byMsg = {}
    for (const f of files ?? []) (byMsg[f.message_id] ||= []).push(f)
    setMessages((msgs ?? []).map((m) => ({ ...m, files: byMsg[m.id] ?? [] })))
  }, [])

  // ---- Create a fresh conversation seeded with the agent greeting ------
  const createConversation = useCallback(async () => {
    const { data: convo, error } = await supabase
      .from('conversations')
      .insert({ user_id: profile.id, agent_id: agent.id, title: 'New conversation' })
      .select()
      .single()
    if (error) { console.error(error); return null }
    if (agent.greeting) {
      await supabase.from('messages').insert({ conversation_id: convo.id, role: 'agent', content: agent.greeting })
    }
    return convo
  }, [agent.id, agent.greeting, profile.id])

  // ---- On agent change: load conversations, create one if needed -------
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', profile.id)
        .eq('agent_id', agent.id)
        .order('updated_at', { ascending: false })
      if (!active) return
      let list = data ?? []
      if (list.length === 0) {
        const convo = await createConversation()
        if (convo) list = [convo]
      }
      if (!active) return
      setConversations(list)
      const first = list[0]?.id ?? null
      setActiveId(first)
      await loadMessages(first)
    })()
    return () => { active = false }
  }, [agent.id, profile.id, createConversation, loadMessages])

  // Keep the thread scrolled to the latest turn.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const refreshConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', profile.id)
      .eq('agent_id', agent.id)
      .order('updated_at', { ascending: false })
    setConversations(data ?? [])
  }, [agent.id, profile.id])

  const newConversation = useCallback(async () => {
    tts.stop()
    const convo = await createConversation()
    if (!convo) return
    setActiveId(convo.id)
    await loadMessages(convo.id)
    await refreshConversations()
    setDraft(''); setAttachments([])
  }, [createConversation, loadMessages, refreshConversations, tts])

  const selectConvo = useCallback(async (id) => {
    tts.stop()
    setActiveId(id)
    await loadMessages(id)
  }, [loadMessages, tts])

  // ---- Attachments: upload to private storage on selection -------------
  const onFilesSelected = useCallback(async (e) => {
    const list = Array.from(e.target.files || [])
    e.target.value = ''
    if (!list.length || !activeId) return
    for (const file of list) {
      const path = `${profile.id}/${activeId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
      if (upErr) { console.error(upErr); continue }
      const { data: row, error } = await supabase
        .from('attachments')
        .insert({ user_id: profile.id, conversation_id: activeId, file_name: file.name, file_size: file.size, storage_path: path, scope: 'conversation' })
        .select()
        .single()
      if (error) { console.error(error); continue }
      setAttachments((a) => [...a, { id: row.id, name: file.name, size: file.size, storage_path: path }])
    }
  }, [activeId, profile.id])

  const removeAttachment = useCallback(async (att) => {
    setAttachments((a) => a.filter((x) => x.id !== att.id))
    await supabase.storage.from('uploads').remove([att.storage_path])
    await supabase.from('attachments').delete().eq('id', att.id)
  }, [])

  // ---- Send a message and get the (stubbed) agent reply ----------------
  const send = useCallback(async () => {
    const text = draft.trim()
    const pending = attachments
    if ((!text && !pending.length) || thinking || !activeId) return

    const { data: userMsg, error } = await supabase
      .from('messages')
      .insert({ conversation_id: activeId, role: 'user', content: text })
      .select()
      .single()
    if (error) { console.error(error); return }

    // Attach pending files to this message.
    if (pending.length) {
      await supabase.from('attachments').update({ message_id: userMsg.id }).in('id', pending.map((p) => p.id))
    }

    // Title a brand-new conversation from its first user message.
    const convo = conversations.find((c) => c.id === activeId)
    if (convo && convo.title === 'New conversation' && text) {
      const title = text.length > 48 ? text.slice(0, 48) + '…' : text
      await supabase.from('conversations').update({ title }).eq('id', activeId)
    }

    setMessages((m) => [...m, { ...userMsg, files: pending.map((p) => ({ file_name: p.name, file_size: p.size })) }])
    setDraft(''); setAttachments([]); setThinking(true)

    const replyText = await generateAgentReply({ agentId: agent.id, conversationId: activeId })
    const { data: agentMsg } = await supabase
      .from('messages')
      .insert({ conversation_id: activeId, role: 'agent', content: replyText })
      .select()
      .single()
    setThinking(false)
    if (agentMsg) setMessages((m) => [...m, { ...agentMsg, files: [] }])
    refreshConversations()
  }, [draft, attachments, thinking, activeId, conversations, agent.id, refreshConversations])

  const copyMsg = useCallback((m) => {
    try { navigator.clipboard?.writeText(m.content) } catch { /* noop */ }
    setCopiedId(m.id)
    setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1600)
  }, [])

  // ---- Flag / correct: mark the message and queue a review item --------
  const flagMsg = useCallback(async (m) => {
    const next = !m.flagged
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, flagged: next } : x)))
    await supabase.from('messages').update({ flagged: next }).eq('id', m.id)
    if (next) {
      const snippet = m.content.length > 220 ? m.content.slice(0, 220) + '…' : m.content
      await supabase.from('review_items').insert({
        type: 'correction',
        title: `Correction to ${agent.name}`,
        submitted_by: profile.id,
        submitted_name: profile.full_name,
        source: 'Flagged on an agent response',
        snippet,
        target: agent.name,
        agent_id: agent.id,
        message_id: m.id,
        status: 'pending',
      })
    } else {
      await supabase.from('review_items').delete().eq('message_id', m.id).eq('status', 'pending')
    }
    onReviewChanged?.()
  }, [agent.id, agent.name, profile.id, profile.full_name, onReviewChanged])

  const footerNote = `${agent.name} reads 24/7 Education's governed knowledge base. Responses are internal and confidential.`

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#e6ecf0', overflow: 'hidden', animation: 'fadeIn .4s ease' }}>

      {/* Sidebar */}
      <aside className="chat-sidebar" style={{ width: 300, flexShrink: 0, background: '#fff', borderRight: '1px solid #e0e6ee', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 18px 0', display: 'flex', alignItems: 'center' }}>
          <img src="/assets/logo.png" alt="24/7 Education" style={{ height: 30, width: 'auto', display: 'block' }} />
        </div>
        <button className="btn-ghost" onClick={onBack}
          style={{ margin: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#63697a', fontSize: 13, fontWeight: 600, padding: 0 }}>
          <Icon name="back" size={16} />All agents
        </button>
        <button className="btn-outline" onClick={newConversation}
          style={{ margin: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `1px solid ${teal}`, background: '#fff', color: teal, borderRadius: 999, padding: 11, fontSize: 14, fontWeight: 600 }}>
          <Icon name="plus" size={17} />New conversation
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9aa3b2', margin: '26px 22px 10px' }}>Recent</div>
        <div className="convos" style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {conversations.map((c) => {
            const active = c.id === activeId
            return (
              <button key={c.id} className="convo-btn" onClick={() => selectConvo(c.id)}
                style={{ textAlign: 'left', border: 'none', background: active ? '#eef5f5' : 'transparent', borderRadius: 10, padding: '11px 13px', display: 'block', width: '100%' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: active ? '#16293f' : '#48535f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                <div style={{ fontSize: 11.5, color: '#9aa3b2', marginTop: 2 }}>{formatRelative(c.updated_at)}</div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e0e6ee', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: '#e3f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: teal, flexShrink: 0 }}>
            <Icon name={agent.icon} size={24} color={teal} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 28", fontSize: 20, letterSpacing: '-.01em', color: '#16293f', margin: 0 }}>{agent.name}</h2>
            <p style={{ fontSize: 13.5, color: '#76808f', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.description}</p>
          </div>
          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#176b70', background: '#e3f4f4', border: '1px solid #c4e6e7', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{agent.clearance_label} clearance</span>
        </header>

        <div className="thread" ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '30px 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px' }}>
            {messages.map((m) => (
              m.role === 'user' ? (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                  <div style={{ maxWidth: '78%', background: '#30455c', color: '#f1f5fa', padding: '14px 18px', borderRadius: '16px 16px 4px 16px', fontSize: 15, lineHeight: 1.55 }}>
                    {m.content && <div style={{ whiteSpace: 'pre-line' }}>{m.content}</div>}
                    {m.files?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: m.content ? 10 : 0 }}>
                        {m.files.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 9, padding: '6px 10px' }}>
                            <span style={{ display: 'flex', color: '#cfe0e0' }}><Icon name="filetext" size={15} color="#cfe0e0" /></span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#eaf0f6', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file_name}</span>
                            <span style={{ fontSize: 11, color: '#aab8c9' }}>{formatSize(f.file_size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} style={{ marginBottom: 30 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: '#e3f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: teal }}>
                      <Icon name={agent.icon} size={15} color={teal} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#27384a', whiteSpace: 'nowrap' }}>{agent.name}</span>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e4eaf1', borderRadius: '4px 16px 16px 16px', padding: '18px 22px', fontSize: 15.5, lineHeight: 1.62, color: '#2b3a4b', whiteSpace: 'pre-line', maxWidth: '92%' }}>{m.content}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 9, paddingLeft: 2 }}>
                    {copiedId === m.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: teal, fontSize: 12.5, fontWeight: 600, padding: '5px 8px' }}><Icon name="check" size={15} color={teal} />Copied</span>
                    ) : (
                      <button className="btn-soft" onClick={() => copyMsg(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8a93a2', fontSize: 12.5, fontWeight: 500, padding: '5px 8px', borderRadius: 7 }}><Icon name="copy" size={15} />Copy</button>
                    )}
                    {m.flagged ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#b3603f', fontSize: 12.5, fontWeight: 600, padding: '5px 8px' }}><Icon name="flag" size={15} color="#b3603f" />Flagged for review</span>
                    ) : (
                      <button className="btn-soft" onClick={() => flagMsg(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8a93a2', fontSize: 12.5, fontWeight: 500, padding: '5px 8px', borderRadius: 7, whiteSpace: 'nowrap' }}><Icon name="flag" size={15} />Flag or correct</button>
                    )}
                    {tts.supported && (
                      tts.playingId === m.id ? (
                        <button onClick={() => tts.speak(m.id, m.content)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef5f5', border: 'none', color: teal, fontSize: 12.5, fontWeight: 600, padding: '5px 8px', borderRadius: 7 }}><Icon name="stop" size={14} fill={teal} color={teal} />Stop</button>
                      ) : (
                        <button className="btn-soft" onClick={() => tts.speak(m.id, m.content)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8a93a2', fontSize: 12.5, fontWeight: 500, padding: '5px 8px', borderRadius: 7 }}><Icon name="volume" size={15} />Listen</button>
                      )
                    )}
                  </div>
                </div>
              )
            ))}

            {thinking && (
              <div style={{ marginBottom: 30 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#e3f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: teal }}>
                    <Icon name={agent.icon} size={15} color={teal} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#27384a' }}>{agent.name}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e4eaf1', borderRadius: '4px 16px 16px 16px', padding: '16px 20px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: teal, display: 'inline-block', animation: 'blink 1.2s infinite 0s' }} />
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: teal, display: 'inline-block', animation: 'blink 1.2s infinite .2s' }} />
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: teal, display: 'inline-block', animation: 'blink 1.2s infinite .4s' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div style={{ background: '#fff', borderTop: '1px solid #e0e6ee', padding: '16px 32px 14px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {attachments.map((f) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f1f5f8', border: '1px solid #dde4ec', borderRadius: 10, padding: '7px 8px 7px 11px' }}>
                    <span style={{ display: 'flex', color: teal }}><Icon name="filetext" size={16} color={teal} /></span>
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#27384a', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: '#9aa3b2' }}>{formatSize(f.size)} · This conversation only</div>
                    </div>
                    <button className="chip-remove" onClick={() => removeAttachment(f)} style={{ background: 'none', border: 'none', color: '#9aa3b2', display: 'flex', padding: 3, borderRadius: 6 }}><Icon name="x" size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ border: '1px solid #d4dde6', borderRadius: 16, background: '#fbfcfd', display: 'flex', flexDirection: 'column' }}>
              <textarea
                placeholder={`Message ${agent.name}...`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1}
                style={{ border: 'none', background: 'transparent', padding: '13px 14px 4px', fontSize: 15, resize: 'none', minHeight: 46, maxHeight: 150, lineHeight: 1.5, color: '#22303f' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Attach a file" style={{ width: 38, height: 38, border: 'none', background: 'none', borderRadius: 10, color: '#6b7585', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="paperclip" size={19} /></button>
                  {stt.supported && (
                    stt.listening ? (
                      <button onClick={stt.toggle} title="Stop dictation" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: 'none', background: '#fbe9e3', color: '#b3603f', borderRadius: 10, height: 38, padding: '0 14px 0 11px', fontSize: 13, fontWeight: 600 }}>
                        <span style={{ position: 'relative', display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="mic" size={14} />
                          <span style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2px solid #e8886a', animation: 'pulse 1.3s infinite' }} />
                        </span>
                        Listening
                      </button>
                    ) : (
                      <button className="btn-icon" onClick={stt.toggle} title="Dictate" style={{ width: 38, height: 38, border: 'none', background: 'none', borderRadius: 10, color: '#6b7585', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="mic" size={19} /></button>
                    )
                  )}
                </div>
                <button className="send-btn" onClick={send} title="Send" style={{ width: 42, height: 42, flexShrink: 0, border: 'none', borderRadius: 11, background: teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={20} color="#fff" /></button>
              </div>
            </div>

            <input type="file" ref={fileInputRef} onChange={onFilesSelected} multiple style={{ display: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, fontSize: 12, color: '#8e97a5' }}>
              <Icon name="shield" size={14} color="#9aa3b2" /><span>{footerNote}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
