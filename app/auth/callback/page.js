'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const [status, setStatus] = useState('Opening the door...')

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const code = new URLSearchParams(window.location.search).get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) { setStatus(error.message); return }
          const { data: { user } } = await supabase.auth.getUser()

          const pendingToken = typeof window !== 'undefined' ? localStorage.getItem('pending_invite_token') : null
          let inviteEventId = null
          if (pendingToken) {
            localStorage.removeItem('pending_invite_token')
            const { data } = await supabase.rpc('consume_invite', { p_token: pendingToken })
            inviteEventId = data
          }

          const { data: profile } = await supabase
            .from('profiles').select('id').eq('id', user.id).maybeSingle()
          if (!profile) { window.location.href = '/onboarding'; return }
          if (inviteEventId) { window.location.href = `/browse/${inviteEventId}`; return }
          const { data: attendee } = await supabase
            .from('event_attendees').select('event_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1).maybeSingle()
          window.location.href = attendee ? `/browse/${attendee.event_id}` : '/join'
        } else {
          window.location.href = '/'
        }
      } catch (e) {
        setStatus(e.message)
      }
    }
    handleAuth()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0E14] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,196,208,0.12),transparent_60%)] pulse-glow" />
      <p className="relative text-[color:var(--gold)]/70 text-xs uppercase tracking-[0.5em] font-light">{status}</p>
    </div>
  )
}
