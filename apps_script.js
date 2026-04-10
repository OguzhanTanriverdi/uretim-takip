// ═══════════════════════════════════════════════════════
//  ÜRETİM TAKİP — Google Apps Script
//  2 sayfa: ÜRETİM + DURUŞ
// ═══════════════════════════════════════════════════════

const SHEET_URETIM = "ÜRETİM";
const SHEET_DURUS  = "DURUŞ";

const HEADERS_URETIM = [
  "TARİH", "VARDİYA", "MAKİNA", "GRUP", "OPERATÖR ADI SOYADI",
  "PARÇA NO", "PARÇA ADI", "OPERASYON NO", "OPERASYON ADI",
  "ÜRETİLEN ADET", "MESAİ", "GÖNDERIM SAATİ"
];

const HEADERS_DURUS = [
  "TARİH", "VARDİYA", "MAKİNA", "GRUP", "OPERATÖR ADI SOYADI",
  "DURUŞ KODU", "DURUŞ ANA TİPİ", "DURUŞ ALT NEDENİ",
  "DURUŞ BAŞLANGIÇ", "DURUŞ BİTİŞ",
  "VARDİYA ÇALIŞMA SÜRESİ (dk)", "DURUŞ SÜRESİ (dk)",
  "MOLA (dk)", "NOTLAR", "GÖNDERIM SAATİ"
];

// Sütun renkleri
const COLOR_URETIM = "#1565C0"; // koyu mavi
const COLOR_DURUS  = "#B71C1C"; // koyu kırmızı

// ── GET: Hem sağlık kontrolü hem veri yazma (CORS bypass)
function doGet(e) {
  if (e.parameter.action === "write") {
    try {
      const data = JSON.parse(decodeURIComponent(e.parameter.data));
      const result = writeData(data);
      return buildResponse(result);
    } catch(err) {
      return buildResponse({ status: "error", message: err.toString() });
    }
  }
  return buildResponse({ status: "ok", message: "Üretim Takip API çalışıyor." });
}

// ── POST: Yedek
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return buildResponse(writeData(data));
  } catch(err) {
    return buildResponse({ status: "error", message: err.toString() });
  }
}

// ── Ana veri yazma
function writeData(data) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  const sheetU = getOrCreateSheet(ss, SHEET_URETIM, HEADERS_URETIM, COLOR_URETIM,
    [70,80,80,90,160,90,180,100,160,80,70,120]);
  const sheetD = getOrCreateSheet(ss, SHEET_DURUS,  HEADERS_DURUS,  COLOR_DURUS,
    [70,80,80,90,160,80,130,200,80,80,120,100,70,160,120]);

  const rows   = data.rows || [];
  const uRows  = [];
  const dRows  = [];

  rows.forEach(r => {
    if (r.durusKod === "D35") {
      // D35 → DURUŞ sayfasına (vardiya tanımı — duruş süresi boş, vardiya süresi dolu)
      dRows.push([
        r.date||"", r.vardiya||"", r.machine||"", r.grup||"", r.operator||"",
        "D35", "DİĞER", "VARDİYA BAŞLANGIÇ VE BİTİŞİ SAATLERİ",
        r.durusBas||"", r.durusBit||"",
        r.varSure||"", "",          // vardiya süresi dolu, duruş süresi boş
        r.molaDk||"", r.not||"", now
      ]);
    } else if (r.durusKod) {
      // Diğer duruş kodları → DURUŞ sayfası
      dRows.push([
        r.date||"", r.vardiya||"", r.machine||"", r.grup||"", r.operator||"",
        r.durusKod||"", r.durusAna||"", r.durusAlt||"",
        r.durusBas||"", r.durusBit||"",
        "", r.durusSure||"",        // vardiya süresi boş, duruş süresi dolu
        "", r.not||"", now
      ]);
    }

    // Her satır ürün bilgisi taşıyorsa → ÜRETİM sayfası
    // (D35 ve duruş satırlarında da ürün bilgisi var — sadece productCode doluysa ekle)
    if (r.productCode && r.qty > 0 && r.durusKod === "D35") {
      // Her ürün sadece D35 satırında bir kez yazılır (tekrar önlemek için)
      uRows.push([
        r.date||"", r.vardiya||"", r.machine||"", r.grup||"", r.operator||"",
        r.productCode||"", r.productName||"",
        r.opCode||"", r.opName||"",
        r.qty||0, r.mesai||"", now
      ]);
    }
  });

  if (uRows.length > 0) {
    sheetU.getRange(sheetU.getLastRow()+1, 1, uRows.length, HEADERS_URETIM.length).setValues(uRows);
    applyAlternateRows(sheetU, HEADERS_URETIM.length);
  }
  if (dRows.length > 0) {
    sheetD.getRange(sheetD.getLastRow()+1, 1, dRows.length, HEADERS_DURUS.length).setValues(dRows);
    applyAlternateRows(sheetD, HEADERS_DURUS.length);
  }

  return { status:"ok", uretim: uRows.length, durus: dRows.length };
}

// ── Sayfa al veya oluştur
function getOrCreateSheet(ss, name, headers, headerColor, colWidths) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setValues([headers]);
    hRange.setBackground(headerColor);
    hRange.setFontColor("#FFFFFF");
    hRange.setFontWeight("bold");
    hRange.setFontFamily("Arial");
    hRange.setFontSize(10);
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 36);
    colWidths.forEach((w, i) => sheet.setColumnWidth(i+1, w));
  }
  return sheet;
}

// ── Zebra renklendirme (hafif)
function applyAlternateRows(sheet, colCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  for (let r = 2; r <= lastRow; r++) {
    const color = r % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
    sheet.getRange(r, 1, 1, colCount).setBackground(color);
  }
  // Filtre güncelle
  try {
    sheet.getFilter()?.remove();
    sheet.getRange(1, 1, lastRow, colCount).createFilter();
  } catch(e) {}
}

function buildResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
