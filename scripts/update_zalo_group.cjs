// scripts/update_zalo_group.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function update() {
  console.log("--- Đang cập nhật nhóm Zalo thành 'MQAA TESTING REPORT'...");
  const { error } = await supabase
    .from('mqaa_settings')
    .update({ 
      patrol_zalo_group: 'MQAA TESTING REPORT',
      zalo_group: 'MQAA TESTING REPORT'
    })
    .eq('id', 1);

  if (error) {
    console.error("Lỗi:", error.message);
  } else {
    console.log(">>> Đã cập nhật thành công!");
  }
}

update();
