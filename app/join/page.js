'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function JoinEvent() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const c = url.searchParams.get('code')
    if (c) setCode(c.toUpperCase().slice(0, 8))
  }, [])

  const joinEvent = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/'; return }
      const user = session.user

      const { data: event, error: eventError } = await supabase
        .from('events').select('id').eq('code', code).single()

      if (eventError || !event) {
        setError('We couldn\'t find that event.')
        setLoading(false)
        return
      }

      const { error: joinError } = await supabase
        .from('event_attendees')
        .upsert({ event_id: event.id, user_id: user.id }, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
      if (joinError) throw joinError

      window.location.href = `/browse/${event.id}`
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-6 pt-16 bg-[#0A0E14] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(184,196,208,0.1),transparent_60%)] pointer-events-none" />
      <div className="relative flex flex-col flex-1 fade-up">
        <div className="mb-12 text-center">
          <p className="text-[10px] tracking-[0.4em] text-[color:var(--gold)]/70 uppercase mb-3 font-light">The Door</p>
          <h1 className="font-display text-5xl font-light gold-text mb-2">Enter the event</h1>
          <p className="text-white/45 font-light">Use the code shared by your host.</p>
        </div>

        <div className="flex-1 space-y-4">
          <input
            type="text"
            inputMode="text"
            maxLength={8}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && joinEvent()}
            className="input-dark w-full rounded-2xl px-4 py-6 text-4xl text-center font-display tracking-[0.6em]"
            autoFocus
          />
          {error && <p className="text-red-300/80 text-sm text-center font-light">{error}</p>}
        </div>

        <button onClick={joinEvent} disabled={loading || !code.trim()}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
          {loading ? 'Entering' : 'Enter'}
        </button>
      </div>
    </div>
  )
}
