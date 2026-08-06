import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectColumns() {
  const { data, error } = await supabase.from('kpi_entries').select('*').limit(1);
  if (error) {
    console.error("Lỗi khi select kpi_entries:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Các cột hiện có trong kpi_entries:", Object.keys(data[0]));
  } else {
    console.log("Bảng kpi_entries trống hoặc không có dữ liệu để kiểm tra.");
  }
}

inspectColumns();
