const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

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
