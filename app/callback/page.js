'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const [status, setStatus] = useState('Logging you in...')

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('Signed in! Checking profile...')
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          window.location.href = '/join'
        } else {
          window.location.href = '/onboarding'
        }
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-400 text-lg">{status}</p>
    </div>
  )
}