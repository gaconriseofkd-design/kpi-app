const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAll() {
  const tables = ['mqaa_patrol_sections', 'mqaa_patrol_criteria', 'mqaa_patrol_auditors', 'mqaa_patrol_logs', 'app_config', 'settings'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(t, error ? error.message : 'EXISTS');
  }
}

checkAll();
