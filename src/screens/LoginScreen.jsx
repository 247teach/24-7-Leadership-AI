import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon, GoogleIcon } from '../lib/icons'

const teal = '#1d6e73'

const fieldWrap = {
  display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px',
  border: '1px solid #d4dde6', borderRadius: 10, background: '#fbfcfd', color: '#8a93a2',
}
const fieldInput = { border: 'none', background: 'transparent', flex: 1, fontSize: 15, color: '#22303f' }
const label = { display: 'block', fontSize: 13, fontWeight: 600, color: '#30455c', margin: '0 0 7px' }

export default function LoginScreen() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async () => {
    setError(''); setNotice('')
    if (!email || !password) { setError('Enter your work email and password.'); return }
    if (mode === 'signup' && !fullName.trim()) { setError('Enter your name so we can set up your profile.'); return }
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password)
        if (error) setError(error.message)
      } else {
        const { data, error } = await signUpWithPassword(email, password, fullName.trim())
        if (error) setError(error.message)
        else if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
      }
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(''); setBusy(true)
    const { error } = await signInWithGoogle()
    if (error) { setError(error.message); setBusy(false) }
    // On success the browser redirects to Google.
  }

  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#e6ecf0', animation: 'fadeIn .45s ease' }}>
      <header style={{ padding: '30px 44px', display: 'flex', alignItems: 'center' }}>
        <img src="/assets/logo.png" alt="24/7 Education" style={{ height: 48, width: 'auto', display: 'block' }} />
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 44px 72px' }}>
        <div className="login-grid" style={{ width: '100%', maxWidth: 1080, display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 72, alignItems: 'center' }}>

          <div className="login-hero" style={{ maxWidth: 520, minWidth: 300 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: teal }}>
              <span style={{ width: 22, height: 1, background: teal, display: 'inline-block' }} />Human Led, AI Facilitated
            </div>
            <h1 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 48", fontSize: 'clamp(34px,4.4vw,52px)', lineHeight: 1.05, letterSpacing: '-.02em', color: '#10243E', margin: '20px 0 0' }}>
              Learn, Create, and Change the World!
            </h1>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 40, border: '1px solid #e5ebf1', boxShadow: '0 24px 48px -16px rgba(16,36,62,.20),0 4px 12px rgba(16,36,62,.07)', minWidth: 300 }}>
            <h2 className="font-display" style={{ fontVariationSettings: "'wght' 600,'SOFT' 0,'opsz' 32", fontSize: 24, letterSpacing: '-.01em', color: '#10243E', margin: '0 0 5px' }}>
              {mode === 'signin' ? 'Team Member sign in' : 'Create your account'}
            </h2>
            <p style={{ fontSize: 14, color: '#76808f', margin: '0 0 26px' }}>Use your 24/7 Education account.</p>

            {mode === 'signup' && (
              <>
                <label style={label}>Full name</label>
                <div style={{ ...fieldWrap, marginBottom: 18 }}>
                  <Icon name="usercheck" size={18} />
                  <input type="text" placeholder="Maya Okafor" value={fullName} onChange={(e) => setFullName(e.target.value)} onKeyDown={onKey} style={fieldInput} />
                </div>
              </>
            )}

            <label style={label}>Work email</label>
            <div style={{ ...fieldWrap, marginBottom: 18 }}>
              <Icon name="mail" size={18} />
              <input type="email" placeholder="you@247education.org" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} style={fieldInput} />
            </div>

            <label style={label}>Password</label>
            <div style={{ ...fieldWrap, marginBottom: 10 }}>
              <Icon name="key" size={18} />
              <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} style={fieldInput} />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                style={{ background: 'none', border: 'none', fontSize: 13, color: teal, fontWeight: 600, padding: 0 }}>
                {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
              </button>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fbe9e3', border: '1px solid #f1cdbf', color: '#b3603f', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
                <Icon name="shield" size={15} color="#b3603f" />{error}
              </div>
            )}
            {notice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e3f4f4', border: '1px solid #c4e6e7', color: '#176b70', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
                <Icon name="check" size={15} color="#176b70" />{notice}
              </div>
            )}

            <button onClick={submit} disabled={busy}
              style={{ width: '100%', height: 50, border: 'none', borderRadius: 999, background: teal, color: '#fff', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.7 : 1, cursor: busy ? 'default' : 'pointer', transition: 'background .14s ease' }}>
              {busy ? <Icon name="spinner" size={18} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
              <span style={{ flex: 1, height: 1, background: '#e6ebf0' }} />
              <span style={{ fontSize: 12, color: '#9aa3b2' }}>or</span>
              <span style={{ flex: 1, height: 1, background: '#e6ebf0' }} />
            </div>

            <button onClick={google} disabled={busy}
              style={{ width: '100%', height: 50, border: '1px solid #d4dde6', borderRadius: 999, background: '#fff', color: '#30455c', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, transition: 'background .14s ease' }}>
              <GoogleIcon />Sign in with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 24, fontSize: 12.5, color: '#8a93a2' }}>
              <Icon name="shield" size={16} color={teal} /><span>Authorized 24/7 Education team members.</span>
            </div>
          </div>

        </div>
      </main>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
