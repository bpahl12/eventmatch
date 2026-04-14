'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TAXONOMY } from '@/lib/taxonomy'
import BottomNav from '@/components/BottomNav'

const INTENT_TAGS = [
  'Open to hire',
  'Looking for a job',
  'Open to invest',
  'Seeking investment',
  'Want a co-founder',
  'Open to collaborate'
]

function TaxonomyEditor({ selected, onToggle, limit = 5, placeholder = 'Search...' }) {
  const [q, setQ] = useState('')
  const list = TAXONOMY.filter(t => t.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <input type="text" placeholder={placeholder} value={q} onChange={e => setQ(e.target.value)}
        className="input-dark w-full rounded-full px-4 py-2.5 font-light text-sm mb-3" />
      <div className="max-h-56 overflow-y-auto no-scrollbar space-y-1.5">
        {list.map(t => {
          const active = selected.includes(t)
          return (
            <button key={t} type="button" onClick={() => onToggle(t)}
              disabled={!active && selected.length >= limit}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-light transition-all ${
                active
                  ? 'bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/60 text-[color:var(--gold-bright)]'
                  : 'bg-white/[0.02] border border-white/10 text-white/70 disabled:opacity-30'
              }`}>
              {t}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-2 text-center">
        {selected.length} of {limit}
      </p>
    </div>
  )
}

export default function Profile() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data: p } = await supabase.from('profiles')
        .select('*').eq('id', session.user.id).maybeSingle()
      if (!p) { router.replace('/onboarding'); return }
      setProfile(p)
      setLoading(false)
    }
    load()
  }, [router])

  const startEdit = () => {
    setForm({
      name: profile.name || '',
      jobTitle: profile.job_title || '',
      company: profile.company || '',
      bio: profile.bio || '',
      tags: profile.tags || [],
      lookingFor: profile.looking_for || [],
      canOffer: profile.can_offer || [],
      photoPreview: profile.photo_url || null
    })
    setPhotoFile(null)
    setEditing(true)
  }

  const cancelEdit = () => { setEditing(false); setForm(null); setPhotoFile(null) }

  const toggleIn = (key, limit) => (value) => {
    setForm(prev => {
      const arr = prev[key]
      if (arr.includes(value)) return { ...prev, [key]: arr.filter(v => v !== value) }
      if (arr.length >= limit) return prev
      return { ...prev, [key]: [...arr, value] }
    })
  }

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : prev.tags.length < 3 ? [...prev.tags, tag] : prev.tags
    }))
  }

  const onPhoto = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setPhotoFile(f)
      setForm(prev => ({ ...prev, photoPreview: URL.createObjectURL(f) }))
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      let photoUrl = profile.photo_url || null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `${user.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
        if (!upErr) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path)
          photoUrl = `${data.publicUrl}?v=${Date.now()}`
        }
      }
      const { data, error } = await supabase.from('profiles').upsert({
        id: user.id,
        name: form.name,
        job_title: form.jobTitle,
        company: form.company,
        bio: form.bio,
        tags: form.tags,
        looking_for: form.lookingFor,
        can_offer: form.canOffer,
        photo_url: photoUrl
      }).select().single()
      if (error) throw error
      setProfile(data)
      setEditing(false)
      setForm(null)
      setPhotoFile(null)
    } catch (e) {
      alert(e.message)
    }
    setSaving(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <p className="text-[color:var(--gold)]/50 text-xs uppercase tracking-[0.4em] font-light">Loading</p>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-[#080808] pb-28 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.08),transparent_60%)] pointer-events-none" />
        <div className="relative max-w-md mx-auto p-6 pt-10 fade-up">
          <div className="flex items-baseline justify-between mb-8">
            <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 font-light">Editing</p>
            <button onClick={cancelEdit} className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-light">Cancel</button>
          </div>

          <label className="block cursor-pointer mb-8">
            <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border border-[color:var(--gold)]/40 bg-[#111111]">
              {form.photoPreview
                ? <img src={form.photoPreview} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">+</div>}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-center py-1 text-[9px] uppercase tracking-[0.3em] text-[color:var(--gold-bright)]">Change</div>
            </div>
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </label>

          <Section title="Basics">
            <input type="text" value={form.name} placeholder="Full name"
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="input-dark w-full rounded-full px-5 py-3 font-light" />
            <input type="text" value={form.jobTitle} placeholder="Job title"
              onChange={(e) => setForm(p => ({ ...p, jobTitle: e.target.value }))}
              className="input-dark w-full rounded-full px-5 py-3 font-light" />
            <input type="text" value={form.company} placeholder="Company"
              onChange={(e) => setForm(p => ({ ...p, company: e.target.value }))}
              className="input-dark w-full rounded-full px-5 py-3 font-light" />
            <textarea value={form.bio} placeholder="Short bio (optional)"
              maxLength={200} rows={3}
              onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
              className="input-dark w-full rounded-2xl px-5 py-3 font-light resize-none" />
          </Section>

          <Section title="What I'm looking for">
            <TaxonomyEditor selected={form.lookingFor} onToggle={toggleIn('lookingFor', 5)} limit={5} placeholder="Search what you need..." />
          </Section>

          <Section title="What I can offer">
            <TaxonomyEditor selected={form.canOffer} onToggle={toggleIn('canOffer', 5)} limit={5} placeholder="Search what you can help with..." />
          </Section>

          <Section title="Intent">
            <div className="grid grid-cols-2 gap-2">
              {INTENT_TAGS.map(tag => {
                const active = form.tags.includes(tag)
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-light transition-all ${
                      active
                        ? 'bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/60 text-[color:var(--gold-bright)]'
                        : 'bg-white/[0.02] border border-white/10 text-white/70'
                    }`}>{tag}</button>
                )
              })}
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-2 text-center">{form.tags.length} of 3</p>
          </Section>

          <button onClick={save}
            disabled={saving || !form.name || !form.jobTitle || !form.company || form.lookingFor.length === 0 || form.canOffer.length === 0}
            className="gold-btn w-full rounded-full py-4 text-sm uppercase tracking-[0.25em] mt-6">
            {saving ? 'Saving' : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] pb-24 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.1),transparent_60%)] pointer-events-none" />
      <div className="relative max-w-md mx-auto p-6 pt-10 fade-up">
        <div className="flex items-baseline justify-between mb-6">
          <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--gold)]/70 font-light">Profile</p>
          <button onClick={startEdit}
            className="ghost-btn rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.25em] font-light">
            Edit
          </button>
        </div>

        <div className="card-glow rounded-3xl p-6 text-center mb-5">
          <div className="w-28 h-28 rounded-full overflow-hidden border border-[color:var(--gold)]/40 bg-[#111111] mx-auto mb-4">
            {profile.photo_url
              ? <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">◯</div>}
          </div>
          <h1 className="font-display text-3xl font-light text-white mb-1">{profile.name}</h1>
          <p className="text-white/55 font-light text-sm">{profile.job_title}{profile.company ? ` · ${profile.company}` : ''}</p>
          {profile.bio && <p className="text-white/65 font-light text-sm mt-4 leading-relaxed">{profile.bio}</p>}
        </div>

        <ViewSection title="Looking for">
          {(profile.looking_for || []).length === 0
            ? <p className="text-white/30 text-sm font-light">None set</p>
            : <ChipList items={profile.looking_for} />}
        </ViewSection>

        <ViewSection title="Can offer">
          {(profile.can_offer || []).length === 0
            ? <p className="text-white/30 text-sm font-light">None set</p>
            : <ChipList items={profile.can_offer} />}
        </ViewSection>

        {(profile.tags || []).length > 0 && (
          <ViewSection title="Intent">
            <ChipList items={profile.tags} />
          </ViewSection>
        )}

        <button onClick={signOut}
          className="w-full text-white/30 py-3 mt-6 text-xs uppercase tracking-[0.3em] font-light hover:text-white/60">
          Sign out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]/60 font-light mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ViewSection({ title, children }) {
  return (
    <div className="glass rounded-2xl p-5 mb-3">
      <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]/60 font-light mb-3">{title}</p>
      {children}
    </div>
  )
}

function ChipList({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(t => (
        <span key={t} className="text-xs px-3 py-1.5 rounded-full border border-[color:var(--gold)]/40 text-[color:var(--gold-bright)] font-light">
          {t}
        </span>
      ))}
    </div>
  )
}
