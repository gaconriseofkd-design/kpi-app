// api/kpi/approve.js
import { adminClient } from './_client.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const supabase = adminClient()
    const { id, decision, note } = req.body || {}

    if (!id || !['approve','reject'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid input' })
    }

    if (decision === 'reject') {
      const { error } = await supabase
        .from('kpi.kpi_entries')
        .update({
          status: 'rejected',
          approver_note: note || null,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) throw error
      return res.json({ ok: true })
    }

    // approve
    const { data: rows, error: e1 } = await supabase
      .from('kpi.kpi_entries')
      .select('id, compliance_code, day_score')
      .eq('id', id).limit(1)

    if (e1) throw e1
    const row = rows?.[0]
    if (!row) return res.status(404).json({ error: 'Not found' })

    const violations = row.compliance_code === 'NONE' ? 0 : 1

    const { error: e2 } = await supabase
      .from('kpi.kpi_entries')
      .update({
        status: 'approved',
        violations,
        approver_note: note || null,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)

    if (e2) throw e2
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
