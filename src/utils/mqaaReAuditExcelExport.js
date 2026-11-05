import ExcelJS from "exceljs";
import { MQAA_RE_AUDIT_TEMPLATE_BASE64 } from "../data/mqaaReAuditTemplateBase64";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria";
import { saveExcelJS } from "../lib/fileExport";

/**
 * Fetch image as base64 string for Excel embedding
 */
async function fetchImageBase64(url) {
    if (!url) return null;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result;
                if (typeof res === "string") {
                    const commaIdx = res.indexOf(",");
                    resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
                } else {
                    resolve(null);
                }
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn("Could not fetch image for Excel export:", url, err);
        return null;
    }
}

/**
 * Export consolidated Re-assessment report matching MQAA TÁI ĐÁNH GIÁ.xlsx
 */
export async function exportReAuditExcel({
    auditorName = "Ngô Thị Bích Ngọc",
    auditDate = "",
    prevWeekLabel = "Phase#2: Week 8",
    prevPostDate = "",
    presWeekLabel = "Phase#2: Week 9",
    presPostDate = "",
    previousSummary = {}, // { [secId]: number (0.0 to 1.0) }
    presentSummary = {},  // { [secId]: number (0.0 to 1.0) }
    previousRatings = {}, // { [secId]: 'Acceptable'|'NI'|'Excellent' }
    presentRatings = {},  // { [secId]: 'Acceptable'|'NI'|'Excellent' }
    trends = {},          // { [secId]: 'Better'|'Sustain'|'Worse' }
    evaluationDataBySection = {}, // { [secId]: Array of items with { excelRow, no, score, notes, problemDescription, imageUrls } }
}) {
    // 1. Load clean template
    const byteChars = atob(MQAA_RE_AUDIT_TEMPLATE_BASE64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(byteArray.buffer);
    const worksheet = workbook.getWorksheet("QA.F-11 P-05") || workbook.worksheets[0];

    // 2. Set Header Information
    worksheet.getCell("C6").value = auditorName || "Ngô Thị Bích Ngọc";
    worksheet.getCell("K5").value = auditDate || new Date().toISOString().split("T")[0];

    // 3. Set Audit Summary Table (Rows 12 to 25)
    if (prevWeekLabel) worksheet.getCell("D12").value = prevWeekLabel;
    if (prevPostDate) worksheet.getCell("D13").value = `Post Date:  : ${prevPostDate}`;
    if (presWeekLabel) worksheet.getCell("F12").value = presWeekLabel;
    if (presPostDate) worksheet.getCell("F13").value = `Post Date:  : ${presPostDate}`;

    let prevSum = 0;
    let prevCount = 0;
    let presSum = 0;
    let presCount = 0;

    MQAA_RE_AUDIT_SECTIONS.forEach((sec) => {
        const row = sec.excelSumRow;
        if (!row) return;

        // Previous Week Compliance %
        const pScore = previousSummary[sec.id];
        if (pScore !== undefined && pScore !== null && pScore !== "") {
            const pVal = Number(pScore);
            worksheet.getCell(`D${row}`).value = pVal;
            prevSum += pVal;
            prevCount++;
        }

        // Previous Rating
        if (previousRatings[sec.id]) {
            worksheet.getCell(`E${row}`).value = previousRatings[sec.id];
        }

        // Present Rating
        if (presentRatings[sec.id]) {
            worksheet.getCell(`G${row}`).value = presentRatings[sec.id];
        }

        // Trend
        if (trends[sec.id]) {
            worksheet.getCell(`H${row}`).value = trends[sec.id];
        }

        const presScore = presentSummary[sec.id];
        if (presScore !== undefined && presScore !== null && presScore !== "") {
            presSum += Number(presScore);
            presCount++;
        }
    });

    // Overall row 25
    if (prevCount > 0) {
        worksheet.getCell("D25").value = prevSum / prevCount;
    }
    if (previousRatings["OVERALL"]) {
        worksheet.getCell("E25").value = previousRatings["OVERALL"];
    }
    if (presentRatings["OVERALL"]) {
        worksheet.getCell("G25").value = presentRatings["OVERALL"];
    }
    if (trends["OVERALL"]) {
        worksheet.getCell("H25").value = trends["OVERALL"];
    }

    // 4. Fill Detail Evaluation for each Section
    for (const sec of MQAA_RE_AUDIT_SECTIONS) {
        const secItems = evaluationDataBySection[sec.id] || [];
        const criteriaItems = MQAA_RE_AUDIT_CRITERIA[sec.id]?.items || [];

        // Build a lookup map by item No or excelRow
        const scoredByRow = {};
        secItems.forEach((it) => {
            if (it.excelRow) scoredByRow[it.excelRow] = it;
            if (it.no) scoredByRow[String(it.no).replace(/\*/g, "").trim()] = it;
        });

        for (const crit of criteriaItems) {
            const targetRow = crit.excelRow;
            if (!targetRow) continue;

            const scored = scoredByRow[targetRow] || scoredByRow[String(crit.no).replace(/\*/g, "").trim()];
            if (!scored) continue;

            // Col H: Audit Score (Col 8)
            const scoreVal = scored.score !== undefined ? scored.score : scored.audit_score;
            if (scoreVal !== undefined && scoreVal !== null && scoreVal !== "") {
                if (scoreVal === "N/A" || crit.maxScore === "N/A") {
                    worksheet.getCell(targetRow, 8).value = "N/A";
                } else {
                    worksheet.getCell(targetRow, 8).value = Number(scoreVal);
                }
            }

            // Col K: Problem description (Col 11)
            const probDesc = scored.problemDescription || scored.problem_description || scored.notes || scored.note || "";
            if (probDesc) {
                worksheet.getCell(targetRow, 11).value = probDesc;
            }

            // Col J: Images (Col 10)
            const imgUrls = scored.imageUrls || scored.image_urls || (scored.image_url ? [scored.image_url] : []);
            if (Array.isArray(imgUrls) && imgUrls.length > 0) {
                const firstImg = imgUrls[0];
                const base64Data = await fetchImageBase64(firstImg);
                if (base64Data) {
                    try {
                        const imageId = workbook.addImage({
                            base64: base64Data,
                            extension: "jpeg",
                        });
                        worksheet.addImage(imageId, {
                            tl: { col: 9.05, row: targetRow - 1 + 0.05 },
                            ext: { width: 60, height: 45 },
                        });
                        worksheet.getRow(targetRow).height = Math.max(worksheet.getRow(targetRow).height || 22, 40);
                    } catch (imgErr) {
                        console.warn("Error embedding image into Excel cell:", imgErr);
                    }
                }
            }
        }
    }

    // 5. Generate and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanDate = (auditDate || new Date().toISOString().split("T")[0]).replace(/[/\\:]/g, "-");
    const filename = `MQAA_TAI_DANH_GIA_${cleanDate}.xlsx`;
    saveExcelJS(buffer, filename);
}

