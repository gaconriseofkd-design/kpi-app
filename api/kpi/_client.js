// api/kpi/_client.js
import { createClient } from '@supabase/supabase-js'

// ❗ Serverless functions chạy trên Node -> dùng process.env
const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey     = process.env.VITE_SUPABASE_KEY
const serviceRole = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl)  throw new Error('❌ Missing VITE_SUPABASE_URL')
if (!anonKey)      throw new Error('❌ Missing VITE_SUPABASE_KEY')

export const supabase = createClient(supabaseUrl, anonKey)

// Dùng cho API admin (bypass RLS)
export function adminClient() {
  if (!serviceRole) throw new Error('❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceRole)
}
