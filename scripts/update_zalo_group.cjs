// scripts/update_zalo_group.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

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
