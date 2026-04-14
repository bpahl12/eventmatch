'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState('email')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('id', session.user.id).single()
      router.replace(profile ? '/join' : '/onboarding')
    }
    checkSession()
  }, [router])

  const sendCode = async () => {
    if (!email) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) alert(error.message)
    else setStep('code')
    setLoading(false)
  }

  const signInWithLinkedIn = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) { alert(error.message); setLoading(false) }
  }

  const verifyCode = async () => {
    if (!token) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) {
      alert('Invalid code. Please try again.')
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('id', user.id).single()
    router.replace(profile ? '/join' : '/onboarding')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,106,0.15),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(168,134,74,0.08),transparent_60%)]" />

      <div className="relative w-full max-w-sm fade-up">
        <div className="text-center mb-16">
          <p className="text-[10px] tracking-[0.5em] text-[color:var(--gold)]/70 uppercase mb-4 font-light">Members Only</p>
          <p className="text-[10px] tracking-[0.5em] text-white/30 uppercase mb-2 font-light">Access</p>
          <h1 className="font-display text-6xl font-light gold-text mb-3 italic">Collective</h1>
          <p className="text-white/45 font-light tracking-wide">
            {step === 'email' ? 'An introduction, for the room.' : `A code was sent to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              className="input-dark w-full rounded-full px-6 py-4 text-base font-light tracking-wide"
            />
            <button
              onClick={sendCode}
              disabled={loading || !email}
              className="gold-btn w-full rounded-full px-6 py-4 text-sm uppercase tracking-[0.25em]"
            >
              {loading ? 'Sending' : 'Request Access'}
            </button>
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-light">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              onClick={signInWithLinkedIn}
              disabled={loading}
              className="ghost-btn w-full rounded-full px-6 py-4 text-sm uppercase tracking-[0.25em] flex items-center justify-center gap-3"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.75 1.75 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>
              Continue with LinkedIn
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              className="input-dark w-full rounded-2xl px-4 py-5 text-3xl text-center font-display tracking-[0.6em]"
              autoFocus
            />
            <button
              onClick={verifyCode}
              disabled={loading || token.length !== 6}
              className="gold-btn w-full rounded-full px-6 py-4 text-sm uppercase tracking-[0.25em]"
            >
              {loading ? 'Verifying' : 'Enter'}
            </button>
            <button
              onClick={() => { setStep('email'); setToken('') }}
              className="w-full text-white/35 py-2 text-xs uppercase tracking-[0.3em] font-light"
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="text-center text-white/30 text-xs font-light mt-12 tracking-wider">
          New here? Entry is by invitation. Open the link your host sent you.
        </p>
      </div>
    </div>
  )
}
