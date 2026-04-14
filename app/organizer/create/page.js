'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000))

export default function CreateEvent() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode()
        const { data, error: insertError } = await supabase
          .from('events').insert({ name: name.trim(), code, organizer_id: user.id })
          .select().single()
        if (!insertError && data) {
          router.push(`/organizer/dashboard/${data.id}`)
          return
        }
        if (insertError && insertError.code !== '23505') throw insertError
      }
      throw new Error('Could not generate a unique code. Try again.')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-6 pt-16 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,106,0.1),transparent_60%)] pointer-events-none" />
      <div className="relative flex flex-col flex-1 fade-up">
        <div className="mb-12">
          <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 mb-3 font-light">Host</p>
          <h1 className="font-display text-5xl font-light gold-text">Curate the evening</h1>
          <p className="text-white/45 mt-2 font-light">A six-digit code will be issued for your guests.</p>
        </div>

        <div className="flex-1 space-y-4">
          <input type="text" placeholder="Event name" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="input-dark w-full rounded-full px-6 py-4 font-light"
            autoFocus />
          {error && <p className="text-red-300/80 text-sm font-light">{error}</p>}
        </div>

        <button onClick={create} disabled={loading || !name.trim()}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
          {loading ? 'Creating' : 'Open the Doors'}
        </button>
      </div>
    </div>
  )
}
