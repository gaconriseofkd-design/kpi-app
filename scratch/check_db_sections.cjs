const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: sections } = await supabase.from('mqaa_patrol_sections').select('*');
  console.log('Current sections in DB:', sections);

  const { data: logs } = await supabase.from('mqaa_patrol_logs').select('section, count').select('section');
  
  const counts = {};
  logs?.forEach(l => counts[l.section] = (counts[l.section] || 0) + 1);
  console.log('Log count by section in DB:', counts);
}

check();
