const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

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
