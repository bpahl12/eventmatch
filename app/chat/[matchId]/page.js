'use client'
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Chat({ params }) {
  const { matchId } = use(params)
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [other, setOther] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [eventId, setEventId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    let channel
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data: match } = await supabase
        .from('matches').select('id, user1_id, user2_id, event_id').eq('id', matchId).single()
      if (!match) { router.push('/matches'); return }
      setEventId(match.event_id)

      const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id
      const { data: profile } = await supabase
        .from('profiles').select('id, name, photo_url').eq('id', otherId).single()
      setOther(profile)

      const { data: msgs } = await supabase.from('messages')
        .select('id, sender_id, content, created_at').eq('match_id', matchId)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])

      channel = supabase.channel(`messages:${matchId}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          (payload) => {
            setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          }
        ).subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [matchId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const reportUser = async () => {
    setMenuOpen(false)
    const reason = window.prompt('Briefly describe the issue (optional):', '') ?? ''
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId, reported_id: other.id, match_id: matchId, event_id: eventId, reason
    })
    if (error) alert(error.message)
    else alert('Thanks — the host has been notified.')
  }

  const blockUser = async () => {
    setMenuOpen(false)
    if (!window.confirm(`Block ${other?.name}? You'll no longer see each other or exchange messages.`)) return
    const { error } = await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: other.id })
    if (error && !/duplicate/i.test(error.message)) { alert(error.message); return }
    router.push('/matches')
  }

  const send = async () => {
    const content = text.trim()
    if (!content || sending || !userId) return
    setSending(true)
    setText('')
    const { data, error } = await supabase.from('messages')
      .insert({ match_id: matchId, sender_id: userId, content }).select().single()
    if (error) setText(content)
    else if (data) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
    }
    setSending(false)
  }

  return (
    <div className="h-screen flex flex-col bg-[#080808]">
      <div className="glass-strong flex items-center gap-3 px-4 py-3 border-b border-[color:var(--gold)]/10">
        <button onClick={() => router.push('/matches')}
          className="text-[color:var(--gold)]/70 text-2xl leading-none px-2 font-light">‹</button>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-[color:var(--gold)]/30">
          {other?.photo_url ? (
            <img src={other.photo_url} alt={other.name} className="w-full h-full object-cover" />
          ) : <div className="w-full h-full bg-white/5" />}
        </div>
        <p className="font-display text-lg font-light text-white flex-1">{other?.name || '...'}</p>
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)}
            className="text-[color:var(--gold)]/70 px-3 text-xl leading-none">⋯</button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 glass-strong rounded-xl border border-[color:var(--gold)]/20 overflow-hidden z-10">
              <button onClick={reportUser}
                className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/5 font-light">Report</button>
              <button onClick={blockUser}
                className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-red-300/80 hover:bg-white/5 font-light border-t border-white/5">Block</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        {messages.length === 0 && other && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-10">
            <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/60 font-light mb-3">You connected</p>
            <p className="font-display text-2xl text-white/70 font-light italic mb-4">Say hi to {other.name?.split(' ')[0]}.</p>
            <p className="text-sm text-white/40 font-light max-w-xs leading-relaxed">
              Start with what you're working on or what you think they might help with.
            </p>
          </div>
        )}
        {messages.map(m => {
          const mine = m.sender_id === userId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm font-light leading-relaxed ${
                mine
                  ? 'bg-gradient-to-br from-[#e8c585] to-[#a8864a] text-black rounded-br-sm'
                  : 'bg-white/[0.06] text-white/90 rounded-bl-sm border border-white/5'
              }`}>
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 glass-strong border-t border-[color:var(--gold)]/10 flex gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <input
          type="text" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Write something considered..."
          className="input-dark flex-1 rounded-full px-5 py-3 text-sm font-light"
        />
        <button onClick={send} disabled={sending || !text.trim()}
          className="gold-btn rounded-full px-6 text-xs uppercase tracking-[0.25em]">
          Send
        </button>
      </div>
    </div>
  )
}
