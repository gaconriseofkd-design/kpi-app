-- Table for MQAA Patrol Sections
CREATE TABLE IF NOT EXISTS mqaa_patrol_sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

-- Table for MQAA Patrol Criteria
CREATE TABLE IF NOT EXISTS mqaa_patrol_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id TEXT REFERENCES mqaa_patrol_sections(id) ON DELETE CASCADE,
    no TEXT NOT NULL,
    label TEXT NOT NULL,
    sub_label TEXT,
    is_header BOOLEAN DEFAULT FALSE,
    max_score INT DEFAULT 6,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INSERT INITIAL SECTIONS
INSERT INTO mqaa_patrol_sections (id, name, sort_order) VALUES
('Raw_Material_Warehouse', 'RAW MATERIAL WAREHOUSE', 10),
('Lamination', 'LAMINATION', 20),
('Prefitting', 'PREFITTING', 30),
('Molding', 'MOLDING', 40),
('Leanline_DC', 'LEANLINE DC', 50),
('Leanline_Molded', 'LEANLINE MOLDED', 60),
('Cutting_Die_Warehouse', 'CUTTING DIE & BOARD WAREHOUSE', 70),
('Logo_Warehouse', 'LOGO WAREHOUSE', 80),
('Finished_Goods_Warehouse', 'FINISHED GOODS WAREHOUSE', 90)
ON CONFLICT (id) DO NOTHING;

-- Note: The criteria items will be populated via the UI or a one-time migration script.
-- For now, we will provide a way to import them in the UI.
