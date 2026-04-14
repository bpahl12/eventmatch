'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

export default function Matches() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState([])
  const [eventId, setEventId] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const user = session.user

      const { data: attendee } = await supabase
        .from('event_attendees').select('event_id, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      if (!attendee) { setLoading(false); return }
      setEventId(attendee.event_id)

      const { data: rawMatches } = await supabase
        .from('matches').select('id, user1_id, user2_id')
        .eq('event_id', attendee.event_id)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

      const otherIds = (rawMatches || []).map(m => m.user1_id === user.id ? m.user2_id : m.user1_id)
      if (otherIds.length === 0) { setMatches([]); setLoading(false); return }

      const { data: profiles } = await supabase
        .from('profiles').select('id, name, job_title, company, photo_url').in('id', otherIds)

      const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      const merged = (rawMatches || []).map(m => ({
        matchId: m.id,
        profile: byId[m.user1_id === user.id ? m.user2_id : m.user1_id]
      })).filter(m => m.profile)

      setMatches(merged)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <p className="text-[color:var(--gold)]/50 text-xs uppercase tracking-[0.4em] font-light">Loading</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col pb-24 relative">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.08),transparent_60%)]" />

      <div className="px-6 pt-12 pb-6">
        <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 mb-2 font-light">Your Circle</p>
        <h1 className="font-display text-4xl font-light gold-text">Network</h1>
      </div>

      {matches.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full border border-[color:var(--gold)]/30 mx-auto mb-6 flex items-center justify-center pulse-glow">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[color:var(--gold-bright)]">
              <circle cx="9" cy="9" r="3" />
              <circle cx="17" cy="11" r="2.3" />
              <path d="M3 19c0.8-3 3.2-5 6-5s5.2 2 6 5" />
              <path d="M14.5 18c0.5-2 2-3.5 4-3.5s3 1 3.5 2.5" />
            </svg>
          </div>
          <p className="text-white/50 font-light">No connections yet. The night is young.</p>
          {eventId && (
            <button onClick={() => router.push(`/browse/${eventId}`)}
              className="gold-btn mt-8 rounded-full px-10 py-3 text-xs uppercase tracking-[0.3em]">
              Continue browsing
            </button>
          )}
        </div>
      ) : (
        <ul className="px-4 space-y-2 fade-up">
          {matches.map(m => (
            <li key={m.matchId}>
              <button
                onClick={() => router.push(`/chat/${m.matchId}`)}
                className="glass w-full flex items-center gap-4 p-4 rounded-2xl text-left active:bg-white/[0.04] transition"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border border-[color:var(--gold)]/30">
                  {m.profile.photo_url ? (
                    <img src={m.profile.photo_url} alt={m.profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">◯</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-xl font-light text-white truncate">{m.profile.name}</p>
                  <p className="text-xs text-white/45 truncate font-light tracking-wide">{m.profile.job_title} · {m.profile.company}</p>
                </div>
                <span className="text-[color:var(--gold)]/60 text-lg font-light">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomNav />
    </div>
  )
}
