// api/kpi/_client.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl   = import.meta.env.VITE_SUPABASE_URL
const anonKey       = import.meta.env.VITE_SUPABASE_KEY
const serviceRole   = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("❌ Missing VITE_SUPABASE_URL")
}
if (!anonKey) {
  throw new Error("❌ Missing VITE_SUPABASE_KEY")
}

export const supabase = createClient(supabaseUrl, anonKey)

export function adminClient() {
  if (!serviceRole) {
    throw new Error("❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(supabaseUrl, serviceRole)
}
