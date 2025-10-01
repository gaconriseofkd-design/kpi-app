// api/kpi/users.js
import { adminClient } from './_client.js'

export default async function handler(req, res) {
  try {
    const supabase = adminClient()

    if (req.method === 'GET') {
      // Lấy danh sách users
      const { data, error } = await supabase
        .from('users')
        .select('*')
      if (error) throw error
      return res.json({ ok: true, rows: data })
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const { data, error } = await supabase
        .from('users')
        .insert([body])
      if (error) throw error
      return res.json({ ok: true, row: data?.[0] })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('❌ Users API error:', e)
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
