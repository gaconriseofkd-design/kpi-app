const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

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
