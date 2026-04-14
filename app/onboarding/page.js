'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TAXONOMY } from '@/lib/taxonomy'

const Shell = ({ children, stepText, title, subtitle }) => (
  <div className="min-h-screen flex flex-col p-6 pt-12 bg-[#080808] relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.08),transparent_60%)] pointer-events-none" />
    <div className="relative flex flex-col flex-1 fade-up">
      <div className="mb-10">
        <p className="text-[10px] tracking-[0.4em] text-[color:var(--gold)]/70 uppercase mb-3 font-light">{stepText}</p>
        <h1 className="font-display text-4xl font-light gold-text">{title}</h1>
        {subtitle && <p className="text-white/45 mt-2 font-light">{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
)

const TAGS = [
  'Open to hire',
  'Looking for a job',
  'Open to invest',
  'Seeking investment',
  'Want a co-founder',
  'Open to collaborate'
]

const TaxonomyPicker = ({ selected, onToggle, limit = 5 }) => {
  const [q, setQ] = useState('')
  const list = TAXONOMY.filter(t => t.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <input type="text" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)}
        className="input-dark w-full rounded-full px-5 py-3 font-light text-sm mb-3" />
      <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-2">
        {list.map(t => {
          const active = selected.includes(t)
          return (
            <button key={t} onClick={() => onToggle(t)}
              disabled={!active && selected.length >= limit}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-light transition-all ${
                active
                  ? 'bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/60 text-[color:var(--gold-bright)]'
                  : 'bg-white/[0.02] border border-white/10 text-white/70 disabled:opacity-30'
              }`}>
              {t}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-3 text-center">
        {selected.length} of {limit} selected
      </p>
    </div>
  )
}

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    jobTitle: '',
    company: '',
    bio: '',
    tags: [],
    lookingFor: [],
    canOffer: [],
    photo: null,
    photoPreview: null,
    remotePhotoUrl: null
  })

  useEffect(() => {
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const m = user.user_metadata || {}
      const metaName = m.name || [m.given_name, m.family_name].filter(Boolean).join(' ')
      const metaPicture = m.picture || m.avatar_url

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, job_title, company, bio, tags, photo_url, looking_for, can_offer')
        .eq('id', user.id).maybeSingle()

      setForm(prev => ({
        ...prev,
        name: profile?.name || metaName || '',
        jobTitle: profile?.job_title || '',
        company: profile?.company || '',
        bio: profile?.bio || '',
        tags: profile?.tags || [],
        lookingFor: profile?.looking_for || [],
        canOffer: profile?.can_offer || [],
        photoPreview: profile?.photo_url || metaPicture || null,
        remotePhotoUrl: profile?.photo_url || metaPicture || null
      }))
    }
    prefill()
  }, [])

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : prev.tags.length < 3
          ? [...prev.tags, tag]
          : prev.tags
    }))
  }

  const toggleIn = (key, limit) => (value) => {
    setForm(prev => {
      const arr = prev[key]
      if (arr.includes(value)) return { ...prev, [key]: arr.filter(v => v !== value) }
      if (arr.length >= limit) return prev
      return { ...prev, [key]: [...arr, value] }
    })
  }

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (file) {
      setForm(prev => ({ ...prev, photo: file, photoPreview: URL.createObjectURL(file) }))
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let photoUrl = form.remotePhotoUrl || null
      if (form.photo) {
        const fileExt = form.photo.name.split('.').pop()
        const filePath = `${user.id}/avatar.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, form.photo, { upsert: true })
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
          photoUrl = data.publicUrl
        }
      }
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name: form.name,
        job_title: form.jobTitle,
        company: form.company,
        bio: form.bio,
        tags: form.tags,
        looking_for: form.lookingFor,
        can_offer: form.canOffer,
        photo_url: photoUrl
      })
      if (error) throw error
      router.push('/join')
    } catch (error) {
      alert(error.message)
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (step === 1) {
    return (
      <Shell stepText="Chapter One of Five" title="Introduce yourself.">
        <div className="space-y-3 flex-1">
          <input type="text" placeholder="Full name" value={form.name}
            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            className="input-dark w-full rounded-full px-6 py-4 font-light" />
          <input type="text" placeholder="Job title" value={form.jobTitle}
            onChange={(e) => setForm(p => ({ ...p, jobTitle: e.target.value }))}
            className="input-dark w-full rounded-full px-6 py-4 font-light" />
          <input type="text" placeholder="Company" value={form.company}
            onChange={(e) => setForm(p => ({ ...p, company: e.target.value }))}
            className="input-dark w-full rounded-full px-6 py-4 font-light" />
          <textarea placeholder="A short bio — location, deal size, anything worth knowing (optional)"
            value={form.bio}
            maxLength={200}
            onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
            rows={3}
            className="input-dark w-full rounded-2xl px-6 py-4 font-light resize-none" />
        </div>
        <button onClick={() => setStep(2)}
          disabled={!form.name || !form.jobTitle || !form.company}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
          Continue
        </button>
      </Shell>
    )
  }

  if (step === 2) {
    return (
      <Shell stepText="Chapter Two of Five" title="What brings you in?" subtitle="Choose up to three.">
        <div className="grid grid-cols-2 gap-3 flex-1">
          {TAGS.map(tag => {
            const active = form.tags.includes(tag)
            return (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`p-4 rounded-2xl text-left font-light text-sm transition-all ${
                  active
                    ? 'bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/60 text-[color:var(--gold-bright)]'
                    : 'bg-white/[0.02] border border-white/10 text-white/70'
                }`}>
                {tag}
              </button>
            )
          })}
        </div>
        <button onClick={() => setStep(3)} disabled={form.tags.length === 0}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
          Continue
        </button>
      </Shell>
    )
  }

  if (step === 3) {
    return (
      <Shell stepText="Chapter Three of Five" title="What are you looking for?" subtitle="Pick the domains you need help in.">
        <TaxonomyPicker selected={form.lookingFor} onToggle={toggleIn('lookingFor', 5)} limit={5} />
        <button onClick={() => setStep(4)} disabled={form.lookingFor.length === 0}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
          Continue
        </button>
      </Shell>
    )
  }

  if (step === 4) {
    return (
      <Shell stepText="Chapter Four of Five" title="What can you offer?" subtitle="What you can help others with.">
        <TaxonomyPicker selected={form.canOffer} onToggle={toggleIn('canOffer', 5)} limit={5} />
        <button onClick={() => setStep(5)} disabled={form.canOffer.length === 0}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
          Continue
        </button>
      </Shell>
    )
  }

  return (
    <Shell stepText="Chapter Five of Five" title="A portrait." subtitle="Profiles with photos receive more introductions.">
      <div className="flex-1 flex flex-col items-center justify-center">
        <label className="cursor-pointer">
          <div className={`w-44 h-44 rounded-full border border-[color:var(--gold)]/30 flex items-center justify-center overflow-hidden relative ${form.photoPreview ? 'border-[color:var(--gold)]/60' : ''}`}>
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.15),transparent_70%)] pulse-glow" />
            {form.photoPreview ? (
              <img src={form.photoPreview} alt="" className="w-full h-full object-cover relative" />
            ) : (
              <div className="text-center text-white/40 relative">
                <div className="text-2xl mb-1 font-light">+</div>
                <p className="text-[10px] uppercase tracking-[0.3em]">Upload</p>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        </label>
      </div>
      <div className="space-y-3 mt-6">
        <button onClick={handleSubmit} disabled={loading}
          className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em]">
          {loading ? 'Saving' : 'Save Profile'}
        </button>
        <button onClick={handleSubmit} disabled={loading}
          className="w-full text-white/35 py-2 text-xs uppercase tracking-[0.3em] font-light">
          Skip for now
        </button>
        <button onClick={handleSignOut}
          className="w-full text-white/25 py-2 text-xs uppercase tracking-[0.3em] font-light hover:text-white/50">
          Sign out
        </button>
      </div>
    </Shell>
  )
}
