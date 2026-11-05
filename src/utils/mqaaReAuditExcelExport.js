import JSZip from "jszip";
import { MQAA_RE_AUDIT_TEMPLATE_BASE64 } from "../data/mqaaReAuditTemplateBase64.js";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria.js";
import { saveExcelJS } from "../lib/fileExport.js";

function escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function setCell(xml, cellRef, value, type = "num", style = null) {
    // Matches either <c r="A1" ... /> OR <c r="A1" ...>...</c>
    const cellRegex = new RegExp(`<c r="${cellRef}"(?:\\s+[^>]*?\\/>|\\s+[^>]*?>[\\s\\S]*?<\\/c>|>([\\s\\S]*?)<\\/c>|\\/>)`);
    const match = xml.match(cellRegex);

    let newCell;
    let sAttr = style ? ` s="${style}"` : "";

    if (match) {
        // Extract existing s="..." if any
        const sMatch = match[0].match(/\ss="(\d+)"/);
        if (sMatch && !style) {
            sAttr = ` s="${sMatch[1]}"`;
        }
    }

    if (type === "str" || type === "inlineStr") {
        const escaped = escapeXml(value);
        newCell = `<c r="${cellRef}"${sAttr} t="inlineStr"><is><t>${escaped}</t></is></c>`;
    } else if (type === "formula") {
        const fEscaped = escapeXml(value.formula || value);
        const vVal = value.value !== undefined ? `<v>${value.value}</v>` : "";
        newCell = `<c r="${cellRef}"${sAttr}><f>${fEscaped}</f>${vVal}</c>`;
    } else {
        if (value === "N/A" || value === "" || value === null || value === undefined || isNaN(value)) {
            if (value === "N/A") {
                newCell = `<c r="${cellRef}"${sAttr} t="inlineStr"><is><t>N/A</t></is></c>`;
            } else {
                return xml;
            }
        } else {
            const numVal = Number(value);
            newCell = `<c r="${cellRef}"${sAttr}><v>${numVal}</v></c>`;
        }
    }

    if (match) {
        return xml.replace(match[0], newCell);
    } else {
        const rowMatch = cellRef.match(/\d+/);
        if (!rowMatch) return xml;
        const rowNum = rowMatch[0];
        const rowRegex = new RegExp(`(<row r="${rowNum}"[^>]*>)([\\s\\S]*?)(<\\/row>)`);
        const rMatch = xml.match(rowRegex);
        if (rMatch) {
            return xml.replace(rMatch[0], `${rMatch[1]}${rMatch[2]}${newCell}</row>`);
        }
    }
    return xml;
}

async function fetchImageBuffer(url) {
    if (!url) return null;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        return await res.arrayBuffer();
    } catch (e) {
        console.warn("Could not fetch image for Excel:", url, e);
        return null;
    }
}

export async function exportReAuditExcel({
    auditorName = "Ngô Thị Bích Ngọc",
    auditDate = "",
    prevWeekLabel = "Phase#2: Week 8",
    prevPostDate = "",
    presWeekLabel = "Phase#2: Week 9",
    presPostDate = "",
    previousSummary = {},
    presentSummary = {},
    previousRatings = {},
    presentRatings = {},
    trends = {},
    evaluationDataBySection = {},
}) {
    const zip = await JSZip.loadAsync(MQAA_RE_AUDIT_TEMPLATE_BASE64, { base64: true });
    let sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("text");

    // 1. Header Information
    sheetXml = setCell(sheetXml, "C6", auditorName || "Ngô Thị Bích Ngọc", "inlineStr");
    sheetXml = setCell(sheetXml, "K5", auditDate || new Date().toISOString().split("T")[0], "inlineStr");

    // 2. Audit Summary Table
    if (prevWeekLabel) sheetXml = setCell(sheetXml, "D12", prevWeekLabel, "inlineStr");
    if (prevPostDate) sheetXml = setCell(sheetXml, "D13", `Post Date:  : ${prevPostDate}`, "inlineStr");
    if (presWeekLabel) sheetXml = setCell(sheetXml, "F12", presWeekLabel, "inlineStr");
    if (presPostDate) sheetXml = setCell(sheetXml, "F13", `Post Date:  : ${presPostDate}`, "inlineStr");

    let prevSum = 0;
    let prevCount = 0;

    MQAA_RE_AUDIT_SECTIONS.forEach((sec) => {
        const row = sec.excelSumRow;
        if (!row) return;

        // Previous compliance %
        const pScore = previousSummary[sec.id];
        if (pScore !== undefined && pScore !== null && pScore !== "" && !isNaN(pScore)) {
            const pVal = Number(pScore);
            sheetXml = setCell(sheetXml, `D${row}`, pVal, "num");
            prevSum += pVal;
            prevCount++;
        }

        // Ratings & Trend
        if (previousRatings[sec.id]) {
            sheetXml = setCell(sheetXml, `E${row}`, previousRatings[sec.id], "inlineStr");
        }
        if (presentRatings[sec.id]) {
            sheetXml = setCell(sheetXml, `G${row}`, presentRatings[sec.id], "inlineStr");
        }
        if (trends[sec.id]) {
            sheetXml = setCell(sheetXml, `H${row}`, trends[sec.id], "inlineStr");
        }
    });

    // Overall Row 25
    if (prevCount > 0) {
        sheetXml = setCell(sheetXml, "D25", prevSum / prevCount, "num");
    }
    if (previousRatings["OVERALL"]) {
        sheetXml = setCell(sheetXml, "E25", previousRatings["OVERALL"], "inlineStr");
    }
    if (presentRatings["OVERALL"]) {
        sheetXml = setCell(sheetXml, "G25", presentRatings["OVERALL"], "inlineStr");
    }
    if (trends["OVERALL"]) {
        sheetXml = setCell(sheetXml, "H25", trends["OVERALL"], "inlineStr");
    }

    // 3. Detail rows for each Section
    const imagesToEmbed = []; // { targetRow, buffer, ext }

    for (const sec of MQAA_RE_AUDIT_SECTIONS) {
        const secItems = evaluationDataBySection[sec.id] || [];
        const criteriaItems = MQAA_RE_AUDIT_CRITERIA[sec.id]?.items || [];

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

            // Col H: Audit Score
            const scoreVal = scored.auditScore !== undefined ? scored.auditScore : (scored.score !== undefined ? scored.score : scored.audit_score);
            if (scoreVal !== undefined && scoreVal !== null && scoreVal !== "") {
                if (scoreVal === "N/A" || crit.maxScore === "N/A") {
                    sheetXml = setCell(sheetXml, `H${targetRow}`, "N/A", "inlineStr");
                } else {
                    sheetXml = setCell(sheetXml, `H${targetRow}`, Number(scoreVal), "num");
                }
            }

            // Col K: Problem description
            const probDesc = scored.notes || scored.problemDescription || scored.problem_description || scored.note || "";
            if (probDesc) {
                sheetXml = setCell(sheetXml, `K${targetRow}`, probDesc, "inlineStr");
            }

            // Col J: Images
            const rawImages = scored.images || scored.image_urls || scored.imageUrls || (scored.image_url ? [scored.image_url] : []);
            let firstUrl = null;
            if (Array.isArray(rawImages) && rawImages.length > 0) {
                firstUrl = typeof rawImages[0] === "string" ? rawImages[0] : rawImages[0]?.url;
            }
            if (firstUrl && firstUrl.startsWith("http")) {
                imagesToEmbed.push({ targetRow, url: firstUrl });
            }
        }
    }

    // 4. Embed Images if any
    if (imagesToEmbed.length > 0) {
        const relationships = [];
        const anchors = [];

        let imgIndex = 1;
        for (const imgItem of imagesToEmbed) {
            const buf = await fetchImageBuffer(imgItem.url);
            if (!buf) continue;

            const fileName = `image${imgIndex}.jpg`;
            zip.file(`xl/media/${fileName}`, buf);

            const rId = `rId${imgIndex}`;
            relationships.push(
                `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${fileName}"/>`
            );

            const row0 = imgItem.targetRow - 1;
            anchors.push(`
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from>
      <xdr:col>9</xdr:col>
      <xdr:colOff>10000</xdr:colOff>
      <xdr:row>${row0}</xdr:row>
      <xdr:rowOff>10000</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>10</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>${row0 + 1}</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:to>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="${imgIndex + 10}" name="Picture ${imgIndex}"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="100000" cy="100000"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`);
            imgIndex++;
        }

        if (relationships.length > 0) {
            const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\r\n${relationships.join("\r\n")}\r\n</Relationships>`;
            zip.file("xl/drawings/_rels/drawing1.xml.rels", relsXml);

            const drXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">\r\n${anchors.join("\r\n")}\r\n</xdr:wsDr>`;
            zip.file("xl/drawings/drawing1.xml", drXml);

            let ct = await zip.file("[Content_Types].xml").async("text");
            if (!ct.includes('Extension="jpg"')) {
                ct = ct.replace(
                    "</Types>",
                    '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/></Types>'
                );
                zip.file("[Content_Types].xml", ct);
            }
        }
    }

    zip.file("xl/worksheets/sheet1.xml", sheetXml);

    const outBuffer = await zip.generateAsync({
        type: "arraybuffer",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        compression: "DEFLATE",
    });

    const cleanDate = (auditDate || new Date().toISOString().split("T")[0]).replace(/[/\\:]/g, "-");
    const filename = `MQAA_TAI_DANH_GIA_${cleanDate}.xlsx`;
    saveExcelJS(outBuffer, filename);
}
