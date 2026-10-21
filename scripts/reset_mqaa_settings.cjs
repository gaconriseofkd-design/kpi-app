// scripts/reset_mqaa_settings.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function reset() {
  console.log("--- Đang reset trạng thái gửi báo cáo...");
  const { error } = await supabase
    .from('mqaa_settings')
    .update({ 
      last_patrol_report_monday: '2026-05-01',
      last_run_date: '2026-05-01'
    })
    .eq('id', 1);

  if (error) {
    console.error("Lỗi:", error.message);
  } else {
    console.log(">>> Đã reset thành công! Bây giờ báo cáo Patrol ngày hôm qua sẽ có thể gửi lại.");
  }
}

reset();
