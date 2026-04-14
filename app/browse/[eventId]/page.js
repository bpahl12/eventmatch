'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { scoreMatch } from '@/lib/taxonomy'
import BottomNav from '@/components/BottomNav'

export default function Browse({ params }) {
  const { eventId } = use(params)
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [match, setMatch] = useState(null)
  const [myPhoto, setMyPhoto] = useState(null)
  const [myLookingFor, setMyLookingFor] = useState([])
  const [myCanOffer, setMyCanOffer] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const user = session.user
      setUserId(user.id)

      const { data: me } = await supabase
        .from('profiles').select('photo_url, looking_for, can_offer').eq('id', user.id).maybeSingle()
      setMyPhoto(me?.photo_url || null)
      setMyLookingFor(me?.looking_for || [])
      setMyCanOffer(me?.can_offer || [])
      const myLookingFor = me?.looking_for || []
      const myCanOffer = me?.can_offer || []

      const [{ data: attendees }, { data: swipes }, { data: myBlocks }, { data: blocksOnMe }] = await Promise.all([
        supabase.from('event_attendees').select('user_id').eq('event_id', eventId),
        supabase.from('swipes').select('swiped_id').eq('event_id', eventId).eq('swiper_id', user.id),
        supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id)
      ])

      const swipedIds = new Set((swipes || []).map(s => s.swiped_id))
      const blockedIds = new Set([
        ...(myBlocks || []).map(b => b.blocked_id),
        ...(blocksOnMe || []).map(b => b.blocker_id)
      ])
      const candidateIds = (attendees || [])
        .map(a => a.user_id)
        .filter(id => id !== user.id && !swipedIds.has(id) && !blockedIds.has(id))

      if (candidateIds.length === 0) { setCards([]); setLoading(false); return }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, job_title, company, bio, tags, photo_url, looking_for, can_offer')
        .in('id', candidateIds)

      const ranked = (profiles || [])
        .map(p => ({
          ...p,
          matchScore: scoreMatch(myLookingFor, p.can_offer, p.looking_for, myCanOffer)
        }))
        .sort((a, b) => b.matchScore - a.matchScore)

      setCards(ranked)
      setLoading(false)
    }
    load()
  }, [eventId, router])

  const handleSwipe = async (direction) => {
    if (acting || cards.length === 0) return
    setActing(true)
    const target = cards[0]

    const { data: matchId } = await supabase.rpc('record_swipe', {
      p_event_id: eventId,
      p_target_id: target.id,
      p_direction: direction
    })

    if (direction === 'connect' && matchId) {
      setMatch({ profile: target, matchId })
    }

    setCards(prev => prev.slice(1))
    setActing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E14]">
        <p className="text-[color:var(--gold)]/50 text-xs uppercase tracking-[0.4em] font-light">Loading</p>
      </div>
    )
  }

  if (match) {
    return (
      <div className="fixed inset-0 bg-[#0A0E14] flex flex-col items-center justify-center p-8 overflow-hidden z-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,196,208,0.28),transparent_65%)] pulse-glow" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(184,196,208,0.12),transparent_60%)]" />

        <div className="relative text-center fade-up w-full max-w-md">
          <p className="text-[10px] uppercase tracking-[0.65em] text-[color:var(--gold)]/70 mb-5 font-light">An introduction</p>
          <h2 className="font-display text-6xl font-light gold-text italic mb-12 leading-none">You Connected</h2>

          <div className="relative flex items-center justify-center mb-12 h-44">
            <div className="absolute inset-0 blur-3xl bg-[color:var(--gold)]/25 pulse-glow" />
            <div className="relative w-36 h-36 rounded-full overflow-hidden border border-[color:var(--gold)]/60 -mr-6 translate-x-0 shadow-[0_0_40px_rgba(184,196,208,0.25)] bg-[#111621]">
              {myPhoto
                ? <img src={myPhoto} alt="you" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">◯</div>}
            </div>
            <div className="relative w-36 h-36 rounded-full overflow-hidden border border-[color:var(--gold)]/60 -ml-6 shadow-[0_0_40px_rgba(184,196,208,0.25)] bg-[#111621]">
              {match.profile.photo_url
                ? <img src={match.profile.photo_url} alt={match.profile.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">◯</div>}
            </div>
          </div>

          <h3 className="font-display text-3xl font-light mb-1">{match.profile.name}</h3>
          <p className="text-white/50 font-light mb-6 tracking-wide">{match.profile.job_title} · {match.profile.company}</p>
          {(() => {
            const theyOffer = (match.profile.can_offer || []).filter(x => myLookingFor.includes(x))
            const theyNeed = (match.profile.looking_for || []).filter(x => myCanOffer.includes(x))
            if (theyOffer.length === 0 && theyNeed.length === 0) return null
            return (
              <div className="mb-10 space-y-2 text-center">
                {theyOffer.length > 0 && (
                  <p className="text-sm font-light text-white/70">
                    They can help with <span className="text-[color:var(--gold-bright)]">{theyOffer.join(', ')}</span>
                  </p>
                )}
                {theyNeed.length > 0 && (
                  <p className="text-sm font-light text-white/70">
                    You can help them with <span className="text-[color:var(--gold-bright)]">{theyNeed.join(', ')}</span>
                  </p>
                )}
              </div>
            )
          })()}

          <div className="w-full max-w-sm mx-auto space-y-3">
            {match.matchId && (
              <button onClick={() => router.push(`/chat/${match.matchId}`)}
                className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em]">
                Send a message
              </button>
            )}
            <button onClick={() => setMatch(null)}
              className="ghost-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em]">
              Keep browsing
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0E14] text-center">
        <div className="fade-up">
          <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 mb-4">Intermission</p>
          <h2 className="font-display text-4xl font-light gold-text mb-3">You're all caught up</h2>
          <p className="text-white/45 mb-10 font-light">No more guests to browse.</p>
          <button onClick={() => router.push('/matches')}
            className="gold-btn rounded-full px-10 py-4 text-sm uppercase tracking-[0.25em]">
            See matches
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  const card = cards[0]
  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col pb-24 relative">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(184,196,208,0.08),transparent_60%)]" />

      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--gold)]/60 font-light">The Room</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-light">{cards.length} remaining</p>
      </div>

      <div className="flex-1 px-4 fade-up" key={card.id}>
        <div className="card-glow relative rounded-[28px] overflow-hidden w-full aspect-[3/4.2] bg-[#111621]">
          {card.photo_url ? (
            <img src={card.photo_url} alt={card.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-6xl text-white/10">◯</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
          {card.matchScore > 0 && (
            <div className="absolute top-4 right-4 z-[3] px-3 py-1.5 rounded-full bg-[#0A0E14]/60 backdrop-blur border border-[color:var(--gold)]/60">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold-bright)] font-light">
                {card.matchScore >= 3 ? 'Strong match' : 'Potential match'}
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-6 z-[2]">
            <h2 className="font-display text-4xl font-light mb-1 text-white">{card.name}</h2>
            <p className="text-white/60 font-light tracking-wide">{card.job_title} · {card.company}</p>
            {card.bio && (
              <p className="text-white/55 font-light text-sm mt-3 leading-relaxed">{card.bio}</p>
            )}
            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {card.tags.map(tag => (
                  <span key={tag} className="text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-[color:var(--gold)]/40 text-[color:var(--gold-bright)] font-light bg-[#0A0E14]/30">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => handleSwipe('skip')} disabled={acting}
          className="ghost-btn py-4 rounded-full text-sm uppercase tracking-[0.25em] disabled:opacity-40">
          Pass
        </button>
        <button onClick={() => handleSwipe('connect')} disabled={acting}
          className="gold-btn py-4 rounded-full text-sm uppercase tracking-[0.25em] flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="9" r="3" />
            <circle cx="17" cy="11" r="2.3" />
            <path d="M3 19c0.8-3 3.2-5 6-5s5.2 2 6 5" />
            <path d="M14.5 18c0.5-2 2-3.5 4-3.5s3 1 3.5 2.5" />
          </svg>
          Connect
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
