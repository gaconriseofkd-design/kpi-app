-- Add columns for Lamination KPI Scoring
ALTER TABLE kpi_lps_entries 
ADD COLUMN IF NOT EXISTS compliance_pairs integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_type text DEFAULT NULL;

-- Comment on columns
COMMENT ON COLUMN kpi_lps_entries.compliance_pairs IS 'Số lần vi phạm tuân thủ (cho Lamination)';
COMMENT ON COLUMN kpi_lps_entries.quality_type IS 'Loại chất lượng: SCRAP hoặc FAIL_BONDING (cho Lamination)';
