const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCrit() {
  const { data, count } = await supabase.from('mqaa_patrol_criteria').select('section_id', { count: 'exact' });
  const counts = {};
  data?.forEach(c => counts[c.section_id] = (counts[c.section_id] || 0) + 1);
  console.log('Criteria count by section_id in DB:', counts);
}

checkCrit();
