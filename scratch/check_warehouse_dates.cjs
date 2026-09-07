const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDates() {
  const { data: raw } = await supabase.from('mqaa_patrol_logs')
    .select('date, auditor_name, overall_performance')
    .eq('section', 'Raw_Material_Warehouse')
    .order('date', { ascending: false });

  const { data: fg } = await supabase.from('mqaa_patrol_logs')
    .select('date, auditor_name, overall_performance')
    .eq('section', 'Finished_Goods_Warehouse')
    .order('date', { ascending: false });

  console.log('Raw Material logs:', raw);
  console.log('Finished Goods logs:', fg);
}

checkDates();
