import { createClient } from '@supabase/supabase-js'

const supabaseUrl   = import.meta.env.VITE_SUPABASE_URL
const anonKey       = import.meta.env.VITE_SUPABASE_KEY
const serviceRole   = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const supabase = createClient(supabaseUrl, anonKey)

export function adminClient() {
  if (!serviceRole) throw new Error("❌ Missing service role key")
  return createClient(supabaseUrl, serviceRole)
}
