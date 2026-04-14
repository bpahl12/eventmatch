'use client'
import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'

export default function Invite({ params }) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState(null)
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: inv } = await supabase
        .from('invites').select('id, event_id, email, consumed_at, consumed_by').eq('token', token).maybeSingle()
      if (!inv) { setError('This invitation is invalid.'); setLoading(false); return }
      setInvite(inv)

      const { data: ev } = await supabase
        .from('events').select('id, name').eq('id', inv.event_id).maybeSingle()
      setEvent(ev)

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await consumeAndRoute()
        return
      }
      if (inv.email) setEmail(inv.email)
      setLoading(false)
    }
    load()
  }, [token])

  const consumeAndRoute = async () => {
    const { data: eventId, error } = await supabase.rpc('consume_invite', { p_token: token })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    window.location.href = profile ? `/browse/${eventId}` : '/onboarding'
  }

  const signInWithLinkedIn = async () => {
    setSending(true)
    localStorage.setItem('pending_invite_token', token)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) { setError(error.message); setSending(false) }
  }

  const sendCode = async () => {
    if (!email) return
    setSending(true)
    localStorage.setItem('pending_invite_token', token)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) { setError(error.message); setSending(false); return }
    setStep('code')
    setSending(false)
  }

  const verifyCode = async () => {
    if (code.length !== 6) return
    setSending(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) { setError('Invalid code.'); setSending(false); return }
    await consumeAndRoute()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E14]">
        <p className="text-[color:var(--gold)]/50 text-xs uppercase tracking-[0.4em] font-light">Verifying invitation</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E14] p-8">
        <div className="text-center fade-up">
          <p className="text-[10px] tracking-[0.5em] text-white/40 uppercase mb-4 font-light">Access denied</p>
          <h1 className="font-display text-4xl font-light gold-text mb-4">{error}</h1>
          <p className="text-white/45 font-light">Ask your host for a new invitation.</p>
        </div>
      </div>
    )
  }

  const alreadyUsed = invite?.consumed_at != null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0A0E14] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(184,196,208,0.15),transparent_55%)]" />
      <div className="relative w-full max-w-sm fade-up">
        <div className="text-center mb-12">
          <p className="text-[10px] tracking-[0.5em] text-[color:var(--gold)]/70 uppercase mb-4 font-light">You're Invited</p>
          <h1 className="font-display text-5xl font-light gold-text mb-3">{event?.name || 'Access Collective'}</h1>
          <p className="text-white/45 font-light">{alreadyUsed ? 'This invitation has been claimed.' : 'Accept your invitation to enter.'}</p>
        </div>

        {!alreadyUsed && step === 'email' && (
          <div className="space-y-4">
            <input type="email" placeholder="your@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              className="input-dark w-full rounded-full px-6 py-4 text-base font-light" />
            <button onClick={sendCode} disabled={sending || !email}
              className="gold-btn w-full rounded-full px-6 py-4 text-sm uppercase tracking-[0.25em]">
              {sending ? 'Sending' : 'Accept Invitation'}
            </button>
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-light">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button onClick={signInWithLinkedIn} disabled={sending}
              className="ghost-btn w-full rounded-full px-6 py-4 text-sm uppercase tracking-[0.25em]">
              Continue with LinkedIn
            </button>
          </div>
        )}

        {!alreadyUsed && step === 'code' && (
          <div className="space-y-4">
            <p className="text-center text-white/50 text-sm font-light">A code was sent to {email}</p>
            <input type="text" inputMode="numeric" maxLength={8} placeholder="••••••"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              className="input-dark w-full rounded-2xl px-4 py-5 text-3xl text-center font-display tracking-[0.4em]"
              autoFocus />
            <button onClick={verifyCode} disabled={sending || code.length < 6}
              className="gold-btn w-full rounded-full px-6 py-4 text-sm uppercase tracking-[0.25em]">
              {sending ? 'Verifying' : 'Enter'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
