# Agent Rules for KPI APP

## PowerShell Script Encoding (UTF-8 with BOM)
- All PowerShell scripts (`.ps1`) in `scripts/` MUST be saved with **UTF-8 WITH BOM** (`0xEF 0xBB 0xBF`).
- Whenever editing any `.ps1` file in `scripts/`, ALWAYS execute `powershell -NoProfile -File scripts/fix_encoding.ps1` immediately after editing to ensure the BOM is preserved.
