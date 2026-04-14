import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const missing = [
    !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !supabaseKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ].filter(Boolean).join(', ')
  throw new Error(`Missing Supabase env vars: ${missing}. Set them in Vercel → Project Settings → Environment Variables and redeploy.`)
}

export const supabase = createClient(supabaseUrl, supabaseKey)