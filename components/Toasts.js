'use client'
import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Toasts() {
  const router = useRouter()
  const pathname = usePathname()
  const [toasts, setToasts] = useState([])
  const userIdRef = useRef(null)
  const matchIdsRef = useRef(new Set())
  const profileCacheRef = useRef(new Map())

  const push = (toast) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }

  const getProfile = async (id) => {
    if (profileCacheRef.current.has(id)) return profileCacheRef.current.get(id)
    const { data } = await supabase.from('profiles').select('id, name, photo_url').eq('id', id).maybeSingle()
    if (data) profileCacheRef.current.set(id, data)
    return data
  }

  useEffect(() => {
    let matchChan, msgChan, cancelled = false

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const me = session.user.id
      userIdRef.current = me

      const { data: myMatches } = await supabase
        .from('matches').select('id, user1_id, user2_id')
        .or(`user1_id.eq.${me},user2_id.eq.${me}`)
      matchIdsRef.current = new Set((myMatches || []).map(m => m.id))

      matchChan = supabase.channel(`toasts:matches:${me}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'matches' },
          async (payload) => {
            const m = payload.new
            if (m.user1_id !== me && m.user2_id !== me) return
            if (matchIdsRef.current.has(m.id)) return
            matchIdsRef.current.add(m.id)
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/browse')) return
            const otherId = m.user1_id === me ? m.user2_id : m.user1_id
            const p = await getProfile(otherId)
            push({
              kind: 'match',
              title: 'New connection',
              body: p?.name ? `You connected with ${p.name}` : 'You have a new connection',
              photo: p?.photo_url || null,
              onClick: () => router.push(`/chat/${m.id}`)
            })
          }
        ).subscribe()

      msgChan = supabase.channel(`toasts:messages:${me}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const msg = payload.new
            if (msg.sender_id === me) return
            if (!matchIdsRef.current.has(msg.match_id)) return
            if (typeof window !== 'undefined' && window.location.pathname === `/chat/${msg.match_id}`) return
            const p = await getProfile(msg.sender_id)
            push({
              kind: 'message',
              title: p?.name || 'New message',
              body: msg.content?.length > 80 ? msg.content.slice(0, 77) + '…' : msg.content,
              photo: p?.photo_url || null,
              onClick: () => router.push(`/chat/${msg.match_id}`)
            })
          }
        ).subscribe()
    }

    init()
    return () => {
      cancelled = true
      if (matchChan) supabase.removeChannel(matchChan)
      if (msgChan) supabase.removeChannel(msgChan)
    }
  }, [router])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => { t.onClick?.(); setToasts(prev => prev.filter(x => x.id !== t.id)) }}
          className="pointer-events-auto w-full max-w-sm glass-strong rounded-2xl p-3 flex items-center gap-3 border border-[color:var(--gold)]/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-left toast-in"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[color:var(--gold)]/40 bg-[#111111] shrink-0">
            {t.photo
              ? <img src={t.photo} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]/70 font-light">{t.kind === 'match' ? 'New connection' : 'Message'}</p>
            <p className="font-display text-sm text-white truncate">{t.title}</p>
            <p className="text-xs text-white/60 font-light truncate">{t.body}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
