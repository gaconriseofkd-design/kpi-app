// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof window !== 'undefined' && window.ENV && window.ENV.VITE_SUPABASE_URL && window.ENV.VITE_SUPABASE_URL !== '__VITE_SUPABASE_URL__')
  ? window.ENV.VITE_SUPABASE_URL
  : (import.meta && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : '')

const supabaseKey = (typeof window !== 'undefined' && window.ENV && window.ENV.VITE_SUPABASE_KEY && window.ENV.VITE_SUPABASE_KEY !== '__VITE_SUPABASE_KEY__')
  ? window.ENV.VITE_SUPABASE_KEY
  : (import.meta && import.meta.env ? import.meta.env.VITE_SUPABASE_KEY : '')

const globalSupabase = (typeof window !== 'undefined') ? (window.supabaseClient || window.supabase) : null;
export const supabase = globalSupabase || (typeof createClient === 'function' && supabaseUrl ? createClient(supabaseUrl, supabaseKey) : null);

export default supabase;
