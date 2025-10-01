// api/kpi/_client.js
import { createClient } from '@supabase/supabase-js'

// Lấy biến môi trường từ Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ Missing Supabase env: VITE_SUPABASE_URL hoặc VITE_SUPABASE_KEY")
}

export const supabase = createClient(supabaseUrl, supabaseKey)
