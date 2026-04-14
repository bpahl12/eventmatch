'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [eventId, setEventId] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const user = session.user
      const { data } = await supabase
        .from('event_attendees')
        .select('event_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setEventId(data.event_id)
    }
    load()
  }, [pathname])

  const items = [
    {
      key: 'browse',
      label: 'Browse',
      active: pathname?.startsWith('/browse'),
      onClick: () => eventId ? router.push(`/browse/${eventId}`) : router.push('/join'),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M4 9h16" />
        </svg>
      ),
    },
    {
      key: 'network',
      label: 'Network',
      active: pathname?.startsWith('/matches') || pathname?.startsWith('/chat'),
      onClick: () => router.push('/matches'),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="9" cy="9" r="3" />
          <circle cx="17" cy="11" r="2.3" />
          <path d="M3 19c0.8-3 3.2-5 6-5s5.2 2 6 5" />
          <path d="M14.5 18c0.5-2 2-3.5 4-3.5s3 1 3.5 2.5" />
        </svg>
      ),
    },
    {
      key: 'profile',
      label: 'Profile',
      active: pathname?.startsWith('/onboarding'),
      onClick: () => router.push('/onboarding'),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.2-3.8 4-6 7.5-6s6.3 2.2 7.5 6" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass-strong pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-3">
        {items.map(it => (
          <button
            key={it.key}
            onClick={it.onClick}
            className={`flex flex-col items-center gap-1 py-3 text-[11px] tracking-[0.2em] uppercase transition-colors ${
              it.active ? 'text-[color:var(--gold-bright)]' : 'text-white/45'
            }`}
          >
            {it.icon}
            <span className="font-light">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
