const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('mqaa_patrol_sections')
    .upsert({ id: '_CONFIG_TARGET_', name: '90', sort_order: 9999 });

  console.log('Upsert target result:', error);

  const { data: read } = await supabase
    .from('mqaa_patrol_sections')
    .select('*')
    .eq('id', '_CONFIG_TARGET_')
    .single();

  console.log('Read back:', read);
}

test();
