// server.cjs
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const WebSocket = require('ws');
global.WebSocket = WebSocket; // Polyfill global WebSocket for Supabase client on Node < 22
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// 1. Tự động kiểm tra và tạo file .env cấu hình nếu chưa có
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  const defaultEnv = `# CẤU HÌNH KẾT NỐI SUPABASE CHO KPI APP CỤC BỘ (LOCAL HOST)
# Bạn có thể chỉnh sửa các giá trị dưới đây mà không cần đóng gói lại file exe.

VITE_SUPABASE_URL=https://doyipagavbxupiwbitgi.supabase.co
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0
VITE_SUPABASE_SERVICE_ROLE_KEY=
PORT=5000
`;
  try {
    fs.writeFileSync(envPath, defaultEnv, 'utf-8');
    console.log('📝 Đã tạo file cấu hình mặc định ".env" ở thư mục hiện hành.');
  } catch (err) {
    console.error('⚠️ Không thể tự động tạo file .env:', err.message);
  }
}

// 2. Load biến môi trường từ file .env hiện hành
function loadEnv() {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
  }
}
loadEnv();

const PORT = process.env.PORT || 5000;
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://doyipagavbxupiwbitgi.supabase.co';
const anonKey = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0';
const serviceRole = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || anonKey; // Fallback về anonKey nếu trống

// Khởi tạo Supabase Clients
const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false }
});
const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false }
});

console.log('--- KHỞI TẠO KPI APP LOCAL SERVER ---');
console.log(`🔗 Supabase URL: ${supabaseUrl}`);
console.log(`🔑 Service Role: ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'Đã cấu hình' : 'Chưa cấu hình (Sử dụng Anon Key làm fallback)'}`);

// ==========================================
// 3. ĐỊNH NGHĨA CÁC ROUTE API (Mô phỏng Vercel Functions)
// ==========================================

// API: Lấy danh sách users
app.route('/api/kpi/users')
  .get(async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('users').select('*');
      if (error) throw error;
      res.json({ ok: true, rows: data });
    } catch (e) {
      console.error('❌ API Error [GET /api/kpi/users]:', e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  })
  .post(async (req, res) => {
    try {
      const body = req.body || {};
      const { data, error } = await supabaseAdmin.from('users').insert([body]).select('*');
      if (error) throw error;
      res.json({ ok: true, row: data?.[0] });
    } catch (e) {
      console.error('❌ API Error [POST /api/kpi/users]:', e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

// API: Lấy các yêu cầu chưa duyệt
app.get('/api/kpi/pending', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('kpi.kpi_entries')
      .select('*')
      .eq('status', 'pending');

    if (error) throw error;
    res.json({ ok: true, rows: data });
  } catch (e) {
    console.error('❌ API Error [GET /api/kpi/pending]:', e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// API: Duyệt hoặc từ chối yêu cầu
app.post('/api/kpi/approve', async (req, res) => {
  try {
    const { id, decision, note } = req.body || {};
    if (!id || !['approve','reject'].includes(decision)) {
      return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ' });
    }

    if (decision === 'reject') {
      const { error } = await supabaseAdmin
        .from('kpi.kpi_entries')
        .update({
          status: 'rejected',
          approver_note: note || null,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      return res.json({ ok: true });
    }

    // approve
    const { data: rows, error: e1 } = await supabaseAdmin
      .from('kpi.kpi_entries')
      .select('id, compliance_code, day_score')
      .eq('id', id).limit(1);

    if (e1) throw e1;
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });

    const violations = row.compliance_code === 'NONE' ? 0 : 1;

    const { error: e2 } = await supabaseAdmin
      .from('kpi.kpi_entries')
      .update({
        status: 'approved',
        violations,
        approver_note: note || null,
        approved_at: new Date().toISOString()
      })
      .eq('id', id);

    if (e2) throw e2;
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ API Error [POST /api/kpi/approve]:', e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// API: Nộp dữ liệu KPI
function scoreProductivity(oe) {
  const x = Number(oe || 0);
  const t = [
    { threshold: 112, score: 10 },
    { threshold: 108, score: 9 },
    { threshold: 104, score: 8 },
    { threshold: 100, score: 7 },
    { threshold: 98,  score: 6 },
    { threshold: 96,  score: 4 },
    { threshold: 94,  score: 2 },
    { threshold: 92,  score: 0 },
  ];
  for (const r of t) if (x >= r.threshold) return r.score;
  return t.at(-1).score;
}

function scoreQuality(defects) {
  const d = Number(defects || 0);
  const rs = [
    { min: 0, max: 0, score: 10 },
    { min: 1, max: 2, score: 8 },
    { min: 3, max: 4, score: 6 },
    { min: 5, max: 6, score: 4 },
    { min: 7, max: null, score: 0 },
  ];
  for (const r of rs) {
    const max = r.max == null ? Infinity : r.max;
    if (d >= r.min && d <= max) return r.score;
  }
  return 0;
}

app.post('/api/kpi/submit', async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      date, workerId, workerName,
      approverId, approverName,
      area, line, ca,
      workHours, stopHours, lineTargetPerHour,
      defects, oe, compliance
    } = payload;

    const pScore = scoreProductivity(oe);
    const qScore = scoreQuality(defects);
    const raw = pScore + qScore;
    const dayScore = Math.min(15, raw);
    const overflow = Math.max(0, raw - 15);

    const { data, error } = await supabase
      .from('kpi.kpi_entries')
      .insert([{
        date,
        worker_id: workerId,
        worker_name: workerName,
        approver_id: approverId,
        approver_name: approverName,
        area,
        line,
        ca,
        work_hours: workHours,
        stop_hours: stopHours,
        line_target_per_hour: lineTargetPerHour,
        defects,
        oe,
        compliance_code: compliance,
        p_score: pScore,
        q_score: qScore,
        day_score: dayScore,
        overflow,
        status: 'pending'
      }])
      .select('id');

    if (error) throw error;
    res.json({ ok: true, id: data?.[0]?.id });
  } catch (e) {
    console.error('❌ API Error [POST /api/kpi/submit]:', e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// API: Tạo báo cáo tổng hợp
app.get('/api/kpi/report', async (req, res) => {
  try {
    const { from, to } = req.query;
    let q = supabaseAdmin
      .from('kpi.kpi_entries')
      .select('*')
      .eq('status', 'approved')
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (from) q = q.gte('date', from);
    if (to)   q = q.lte('date', to);

    const { data, error } = await q;
    if (error) throw error;

    const byWorkerMonth = {};
    for (const r of data) {
      const key = `${r.worker_id}-${r.date.slice(0,7)}`;
      byWorkerMonth[key] ??= { totalDay: 0, viol: 0 };
      byWorkerMonth[key].totalDay += Number(r.day_score || 0);
      byWorkerMonth[key].viol += Number(r.violations || 0);
    }

    function applyPenalty(total, viol) {
      if (viol >= 3) return +(total * 0.8).toFixed(2);
      if (viol > 0)  return +(total * 0.95).toFixed(2);
      return +(+total).toFixed(2);
    }

    const rows = data.map(r => {
      const key = `${r.worker_id}-${r.date.slice(0,7)}`;
      const agg = byWorkerMonth[key];
      const month_score_total = applyPenalty(agg.totalDay, agg.viol);
      return { ...r, month_score_total };
    });

    res.json({ ok: true, rows });
  } catch (e) {
    console.error('❌ API Error [GET /api/kpi/report]:', e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});


// ==========================================
// 4. PHỤC VỤ TRANG WEB TĨNH (VỚI INJECT CONFIG)
// ==========================================

// Phục vụ tài nguyên tĩnh của Vite React (bỏ qua index.html để route động xử lý)
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// Xử lý tất cả các request khác (Single Page Application routing)
app.get(/^(?!\/api).*$/, (req, res, next) => {
  // Bỏ qua nếu có đuôi file tĩnh
  if (req.path.includes('.')) {
    return next();
  }
  const htmlPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf-8');
    // Inject runtime keys từ .env vào index.html
    html = html.replace('__VITE_SUPABASE_URL__', process.env.VITE_SUPABASE_URL || '');
    html = html.replace('__VITE_SUPABASE_KEY__', process.env.VITE_SUPABASE_KEY || '');
    res.send(html);
  } else {
    res.status(404).send('Không tìm thấy thư mục dist/index.html. Hãy chạy lệnh "npm run build" trước.');
  }
});

// ==========================================
// 5. KHỞI CHẠY SERVER VÀ MỞ TRÌNH DUYỆT TỰ ĐỘNG
// ==========================================

function openBrowser(url) {
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${startCmd} ${url}`, (err) => {
    if (err) {
      console.log(`🔔 Vui lòng truy cập trình duyệt bằng tay: ${url}`);
    }
  });
}

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n======================================================');
  console.log(`🚀 KPI App Local Server đang chạy tại: ${url}`);
  console.log('📂 Đang phục vụ trang web và API cục bộ.');
  console.log('💡 Nhấn [Ctrl + C] để dừng Server.');
  console.log('======================================================\n');
  
  // Tự động mở trình duyệt mặc định
  openBrowser(url);
});
