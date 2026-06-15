import { useCallback, useEffect, useRef, useState } from 'react'

// -------- Text to speech (read aloud) --------
// Uses the browser SpeechSynthesis API. Tracks which message is playing so the
// UI can toggle Listen/Stop. Returns { playingId, speak, stop, supported }.
export function useTextToSpeech() {
  const [playingId, setPlayingId] = useState(null)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setPlayingId(null)
  }, [supported])

  const speak = useCallback((id, text) => {
    if (!supported) return
    if (playingId === id) { stop(); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1; u.pitch = 1
    u.onend = () => setPlayingId((cur) => (cur === id ? null : cur))
    setPlayingId(id)
    window.speechSynthesis.speak(u)
  }, [supported, playingId, stop])

  useEffect(() => () => { try { window.speechSynthesis?.cancel() } catch { /* noop */ } }, [])

  return { playingId, speak, stop, supported }
}

// -------- Speech to text (dictation) --------
// Uses the Web Speech Recognition API (webkitSpeechRecognition in Chrome/Edge).
// onResult receives the recognized transcript to append to the draft. When the
// API is unavailable we report supported:false so the composer can hide the mic.
export function useSpeechToText(onResult) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const supported = !!SpeechRecognition

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop() } catch { /* noop */ }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!supported) return
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (transcript) onResult(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }, [supported, SpeechRecognition, onResult])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => { try { recognitionRef.current?.stop() } catch { /* noop */ } }, [])

  return { listening, toggle, supported }
}
