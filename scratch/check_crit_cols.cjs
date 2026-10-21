const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCritCols() {
  const { data } = await supabase.from('mqaa_patrol_criteria').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('mqaa_patrol_criteria columns:', Object.keys(data[0]));
  }
}

checkCritCols();
