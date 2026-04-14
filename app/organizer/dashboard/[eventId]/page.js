'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'

const makeToken = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let t = ''
  for (let i = 0; i < 12; i++) t += alphabet[Math.floor(Math.random() * alphabet.length)]
  return t
}

export default function Dashboard({ params }) {
  const { eventId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState(null)
  const [stats, setStats] = useState({ attendees: 0, matches: 0, messages: 0 })
  const [invites, setInvites] = useState([])
  const [generating, setGenerating] = useState(false)
  const [count, setCount] = useState(5)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [attendees, setAttendees] = useState([])
  const [reports, setReports] = useState([])
  const [topDomains, setTopDomains] = useState([])

  useEffect(() => {
    setOrigin(window.location.origin)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: ev } = await supabase.from('events')
        .select('id, name, code').eq('id', eventId).single()
      if (!ev) { router.push('/organizer/create'); return }
      setEvent(ev)

      const [attendeesRes, matchesRes, invitesRes, reportsRes] = await Promise.all([
        supabase.from('event_attendees').select('user_id, created_at').eq('event_id', eventId),
        supabase.from('matches').select('id, user1_id, user2_id', { count: 'exact' }).eq('event_id', eventId),
        supabase.from('invites').select('id, token, consumed_at, created_at').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('reports').select('id, reporter_id, reported_id, reason, created_at').eq('event_id', eventId).order('created_at', { ascending: false })
      ])

      const attendeeIds = (attendeesRes.data || []).map(a => a.user_id)
      const { data: profiles } = attendeeIds.length
        ? await supabase.from('profiles').select('id, name, job_title, company, photo_url, looking_for, can_offer').in('id', attendeeIds)
        : { data: [] }
      const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      const swipersSet = new Set()
      const { data: swipes } = await supabase.from('swipes').select('swiper_id').eq('event_id', eventId)
      for (const s of swipes || []) swipersSet.add(s.swiper_id)

      const merged = (attendeesRes.data || []).map(a => ({
        ...profileById[a.user_id],
        id: a.user_id,
        joinedAt: a.created_at,
        engaged: swipersSet.has(a.user_id)
      })).filter(a => a.name || a.id)
      setAttendees(merged)

      const domainCounts = {}
      for (const m of matchesRes.data || []) {
        const p1 = profileById[m.user1_id], p2 = profileById[m.user2_id]
        if (!p1 || !p2) continue
        const hits = []
        for (const d of p1.looking_for || []) if ((p2.can_offer || []).includes(d)) hits.push(d)
        for (const d of p2.looking_for || []) if ((p1.can_offer || []).includes(d)) hits.push(d)
        for (const d of hits) domainCounts[d] = (domainCounts[d] || 0) + 1
      }
      setTopDomains(
        Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      )

      setReports(reportsRes.data || [])

      const matchIds = (matchesRes.data || []).map(m => m.id)
      let messageCount = 0
      if (matchIds.length > 0) {
        const { count } = await supabase.from('messages')
          .select('id', { count: 'exact', head: true }).in('match_id', matchIds)
        messageCount = count || 0
      }

      setStats({
        attendees: attendeesRes.count || 0,
        matches: matchesRes.count || 0,
        messages: messageCount
      })
      setInvites(invitesRes.data || [])
      setLoading(false)

      const joinUrl = `${window.location.origin}/join?code=${ev.code}`
      try {
        const url = await QRCode.toDataURL(joinUrl, {
          margin: 1,
          width: 512,
          color: { dark: '#e8c585', light: '#0a0806' }
        })
        setQrDataUrl(url)
      } catch {}
    }
    load()
  }, [eventId, router])

  const shareLink = origin && event ? `${origin}/join?code=${event.code}` : ''

  const copyShareLink = async () => {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  const removeAttendee = async (userId, name) => {
    if (!window.confirm(`Remove ${name || 'this attendee'} from the event? They won't be able to browse or message.`)) return
    const { error } = await supabase.from('event_attendees').delete().match({ event_id: eventId, user_id: userId })
    if (error) { alert(error.message); return }
    setAttendees(prev => prev.filter(a => a.id !== userId))
  }

  const generate = async () => {
    setGenerating(true)
    const n = Math.max(1, Math.min(50, parseInt(count) || 1))
    const { data: { user } } = await supabase.auth.getUser()
    const rows = Array.from({ length: n }, () => ({
      event_id: eventId, token: makeToken(), created_by: user.id
    }))
    const { data, error } = await supabase.from('invites').insert(rows).select('id, token, consumed_at, created_at')
    if (error) alert(error.message)
    else setInvites(prev => [...(data || []), ...prev])
    setGenerating(false)
  }

  const copy = async (text, id) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 1200)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <p className="text-[color:var(--gold)]/50 text-xs uppercase tracking-[0.4em] font-light">Loading</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] p-6 pt-12 pb-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.1),transparent_60%)] pointer-events-none" />
      <div className="relative fade-up max-w-xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 mb-2 font-light">The House</p>
        <h1 className="font-display text-4xl font-light gold-text mb-8">{event?.name}</h1>

        <div className="card-glow rounded-3xl p-8 mb-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--gold)]/10 via-transparent to-[color:var(--gold)]/5" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 mb-3 font-light">Invitation Code</p>
            <p className="font-display text-6xl tracking-[0.3em] gold-text font-light mb-6">{event?.code}</p>
            {qrDataUrl && (
              <div className="flex justify-center mb-5">
                <div className="p-3 rounded-2xl bg-[#080808]/40 border border-[color:var(--gold)]/30">
                  <img src={qrDataUrl} alt="Scan to join" className="w-44 h-44" />
                </div>
              </div>
            )}
            <button onClick={copyShareLink}
              className="ghost-btn rounded-full px-6 py-2.5 text-[11px] uppercase tracking-[0.25em]">
              {linkCopied ? 'Link copied' : 'Copy join link'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-10">
          <Stat label="Guests" value={stats.attendees} />
          <Stat label="Matches" value={stats.matches} />
          <Stat label="Messages" value={stats.messages} />
        </div>

        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--gold)]/70 font-light">Invitations</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-light">
              {invites.filter(i => i.consumed_at).length}/{invites.length} claimed
            </p>
          </div>
          <div className="flex gap-2 mb-4">
            <input type="number" min={1} max={50} value={count}
              onChange={(e) => setCount(e.target.value)}
              className="input-dark w-20 rounded-full px-4 py-3 font-light text-center" />
            <button onClick={generate} disabled={generating}
              className="gold-btn flex-1 rounded-full px-6 py-3 text-sm uppercase tracking-[0.25em]">
              {generating ? 'Generating' : 'Generate invites'}
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
            {invites.length === 0 && (
              <p className="text-white/30 text-sm font-light text-center py-6">No invitations yet.</p>
            )}
            {invites.map(inv => {
              const url = `${origin}/invite/${inv.token}`
              const claimed = !!inv.consumed_at
              return (
                <div key={inv.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${claimed ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-[color:var(--gold)]/20 bg-[#080808]/30'}`}>
                  <span className="flex-1 font-mono text-xs text-white/70 truncate">{url}</span>
                  {claimed
                    ? <span className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-light">Claimed</span>
                    : <button onClick={() => copy(url, inv.id)}
                        className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--gold-bright)] font-light px-3 py-1 rounded-full border border-[color:var(--gold)]/40">
                        {copied === inv.id ? 'Copied' : 'Copy'}
                      </button>}
                </div>
              )
            })}
          </div>
        </div>

        {topDomains.length > 0 && (
          <div className="glass rounded-3xl p-6 mb-6">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--gold)]/70 font-light mb-4">Top connection domains</p>
            <div className="space-y-2">
              {topDomains.map(([domain, n]) => (
                <div key={domain} className="flex items-center justify-between">
                  <span className="text-sm font-light text-white/75">{domain}</span>
                  <span className="text-xs font-light text-[color:var(--gold-bright)]">{n} match{n === 1 ? '' : 'es'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--gold)]/70 font-light">Attendees</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-light">
              {attendees.filter(a => a.engaged).length}/{attendees.length} engaged
            </p>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
            {attendees.length === 0 && (
              <p className="text-white/30 text-sm font-light text-center py-6">No attendees yet.</p>
            )}
            {attendees.map(a => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl px-3 py-2 border border-white/5 bg-white/[0.02]">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#111111] border border-[color:var(--gold)]/20 shrink-0">
                  {a.photo_url
                    ? <img src={a.photo_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light text-white truncate">{a.name || 'Unnamed'}</p>
                  <p className="text-[10px] text-white/40 font-light truncate">{a.job_title} · {a.company}</p>
                </div>
                <span className={`text-[9px] uppercase tracking-[0.25em] font-light ${a.engaged ? 'text-[color:var(--gold-bright)]' : 'text-white/30'}`}>
                  {a.engaged ? 'Active' : 'Idle'}
                </span>
                <button onClick={() => removeAttendee(a.id, a.name)}
                  className="text-[9px] uppercase tracking-[0.25em] text-red-300/70 px-2 py-1 rounded-full border border-red-300/20 font-light">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {reports.length > 0 && (
          <div className="glass rounded-3xl p-6 mb-6 border border-red-300/10">
            <p className="text-[10px] uppercase tracking-[0.4em] text-red-300/70 font-light mb-4">Reports ({reports.length})</p>
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="rounded-xl px-3 py-2 border border-red-300/10 bg-red-300/[0.03]">
                  <p className="text-[10px] text-white/50 font-light">{new Date(r.created_at).toLocaleString()}</p>
                  <p className="text-xs text-white/80 font-light mt-1">Reporter: {r.reporter_id.slice(0, 8)} → Reported: {r.reported_id.slice(0, 8)}</p>
                  {r.reason && <p className="text-sm text-white/75 font-light mt-1">"{r.reason}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="glass rounded-2xl p-5 text-center">
      <p className="font-display text-4xl font-light gold-text">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.3em] text-white/50 mt-1 font-light">{label}</p>
    </div>
  )
}
