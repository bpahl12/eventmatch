/* eslint-disable */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EVENT_CODE = '123456'

const argv = process.argv.slice(2)
const matchWithIdx = argv.indexOf('--match-with')
const MATCH_WITH_EMAIL = matchWithIdx >= 0 ? argv[matchWithIdx + 1] : null
const MATCH_COUNT = 5

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TAGS = [
  'Open to hire',
  'Looking for a job',
  'Open to invest',
  'Seeking investment',
  'Want a co-founder',
  'Open to collaborate'
]

const PEOPLE = [
  { name: 'Amelia Chen',      jobTitle: 'Founder & CEO',           company: 'Northlight Labs',
    canOffer: ['Consumer brands', 'Brand & marketing'], lookingFor: ['Venture capital', 'Legal — corporate'] },
  { name: 'Marcus Alvarez',   jobTitle: 'Partner',                 company: 'Meridian Capital',
    canOffer: ['Venture capital', 'Angel investing'], lookingFor: ['AI / machine learning', 'Fintech'] },
  { name: 'Priya Nair',       jobTitle: 'Head of Product',         company: 'Orbit',
    canOffer: ['Product management', 'Product design'], lookingFor: ['Recruiting & talent', 'Brand & marketing'] },
  { name: 'James O\'Connell', jobTitle: 'Principal Engineer',      company: 'Foundry',
    canOffer: ['Software engineering', 'AI / machine learning'], lookingFor: ['Product management', 'Angel investing'] },
  { name: 'Sofia Laurent',    jobTitle: 'Design Director',         company: 'Maison Studio',
    canOffer: ['Interior design', 'Architecture'], lookingFor: ['Hotel development', 'General contracting'] },
  { name: 'Daniel Park',      jobTitle: 'Investor',                company: 'Park Ventures',
    canOffer: ['Angel investing', 'Family office'], lookingFor: ['Proptech', 'Fintech'] },
  { name: 'Noor Hassan',      jobTitle: 'CTO',                     company: 'Ledger AI',
    canOffer: ['AI / machine learning', 'Software engineering'], lookingFor: ['Sales leadership', 'Venture capital'] },
  { name: 'Elena Rossi',      jobTitle: 'Growth Lead',             company: 'Atlas',
    canOffer: ['Performance marketing', 'Brand & marketing'], lookingFor: ['Recruiting & talent', 'PR & communications'] },
  { name: 'Kenji Tanaka',     jobTitle: 'Product Manager',         company: 'Hearth',
    canOffer: ['Product management', 'Hospitality operations'], lookingFor: ['Software engineering', 'Interior design'] },
  { name: 'Zara Ahmed',       jobTitle: 'Solo Founder',            company: 'Quill',
    canOffer: ['Media & content', 'PR & communications'], lookingFor: ['Angel investing', 'Legal — IP'] },
  { name: 'Owen Mitchell',    jobTitle: 'Managing Director',       company: 'Crestline Hospitality',
    canOffer: ['Hotel development', 'Hospitality operations', 'General contracting'], lookingFor: ['Hospitality operations', 'Construction financing'] },
  { name: 'Isabella Romano',  jobTitle: 'Principal',               company: 'Romano Build Co.',
    canOffer: ['General contracting', 'Hotel development'], lookingFor: ['Architecture', 'Interior design'] }
]

const pickTags = () => {
  const n = 1 + Math.floor(Math.random() * 3)
  return [...TAGS].sort(() => Math.random() - 0.5).slice(0, n)
}

const ensureUser = async (email, metadata) => {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email, email_confirm: true, user_metadata: metadata
  })
  if (!error) return created.user.id
  if (!/already|registered|exists/i.test(error.message)) throw error
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list?.users?.find(u => u.email === email)
  if (!found) throw new Error(`could not resolve existing user ${email}`)
  return found.id
}

const run = async () => {
  let { data: event } = await supabase
    .from('events').select('id').eq('code', EVENT_CODE).maybeSingle()

  if (!event) {
    console.log(`No event with code ${EVENT_CODE}, creating one...`)
    const organizerId = await ensureUser('organizer.seed@eventmatch.test', { name: 'Seed Organizer', seeded: true })
    const { data: created, error: createErr } = await supabase
      .from('events')
      .insert({ name: 'Seeded Event', code: EVENT_CODE, organizer_id: organizerId })
      .select('id').single()
    if (createErr) { console.error('Failed to create event:', createErr.message); process.exit(1) }
    event = created
  }
  console.log(`Using event ${event.id} (code ${EVENT_CODE})`)

  const seededIds = []
  for (const p of PEOPLE) {
    const slug = p.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')
    const email = `${slug}.seed@eventmatch.test`

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: p.name, seeded: true }
    })

    let userId = created?.user?.id
    if (createErr) {
      if (!/already|registered|exists/i.test(createErr.message)) {
        console.error(`  createUser failed for ${email}:`, createErr.message)
        continue
      }
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
      userId = list?.users?.find(u => u.email === email)?.id
      if (!userId) { console.error(`  could not resolve existing user ${email}`); continue }
    }

    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      name: p.name,
      job_title: p.jobTitle,
      company: p.company,
      tags: pickTags(),
      looking_for: p.lookingFor || [],
      can_offer: p.canOffer || [],
      photo_url: null
    })
    if (profileErr) { console.error(`  profile upsert failed for ${email}:`, profileErr.message); continue }

    const { error: joinErr } = await supabase.from('event_attendees').upsert(
      { event_id: event.id, user_id: userId },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true }
    )
    if (joinErr) { console.error(`  join failed for ${email}:`, joinErr.message); continue }

    seededIds.push(userId)
    console.log(`  ✓ ${p.name} (${email})`)
  }

  if (MATCH_WITH_EMAIL) {
    console.log(`\nPre-swiping "connect" from ${MATCH_COUNT} seeded users to ${MATCH_WITH_EMAIL}...`)
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const target = list?.users?.find(u => u.email === MATCH_WITH_EMAIL)
    if (!target) {
      console.error(`  could not find user with email ${MATCH_WITH_EMAIL}. Sign up in the app first.`)
      process.exit(1)
    }
    const targetId = target.id

    const { error: joinErr } = await supabase.from('event_attendees').upsert(
      { event_id: event.id, user_id: targetId },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true }
    )
    if (joinErr) console.error('  (could not ensure target is in event):', joinErr.message)

    const swipers = seededIds.slice(0, MATCH_COUNT)
    const rows = swipers.map(swiperId => ({
      event_id: event.id, swiper_id: swiperId, swiped_id: targetId, direction: 'connect'
    }))
    const { error: swipeErr } = await supabase.from('swipes').upsert(
      rows,
      { onConflict: 'event_id,swiper_id,swiped_id', ignoreDuplicates: true }
    )
    if (swipeErr) console.error('  swipe insert failed:', swipeErr.message)
    else console.log(`  ✓ ${swipers.length} seeded users now have "connect" swipes on you`)
    console.log('  → swipe connect on any of them in the app to create a match')
  }

  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
