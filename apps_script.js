// ═══════════════════════════════════════════════════════
//  ÜRETİM TAKİP — Google Apps Script
//  Bu kodu Apps Script'e yapıştırın, kaydedin ve Deploy edin
// ═══════════════════════════════════════════════════════

const SHEET_NAME = "VERİ";  // Verinin yazılacağı sayfa adı

// Sütun başlıkları — formdan gelen veriyle aynı sıra
const HEADERS = [
  "TARİH", "VARDİYA", "GRUP", "MAKİNA", "OPERATÖR ADI SOYADI",
  "ÜRÜN KODU", "ÜRÜN ADI", "OPERASYON KODU", "OPERASYON ADI",
  "ÜRETİM MİKTARI (adet)",
  "DURUŞ KODU", "DURUŞ ANA TİPİ", "DURUŞ ALT NEDENİ",
  "DURUŞ BAŞLANGIÇ", "DURUŞ BİTİŞ", "DURUŞ SÜRESİ (dk)",
  "VARDİYA SÜRESİ (dk)", "DURUŞ NOTU",
  "GÖNDERIM SAATİ"
];

// ── GET: Hem sağlık kontrolü hem veri yazma (CORS bypass için)
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

// ── POST: Yedek olarak POST da destekleniyor
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return buildResponse(writeData(data));
  } catch(err) {
    return buildResponse({ status: "error", message: err.toString() });
  }
}

// ── Ortak veri yazma fonksiyonu
function writeData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const hRow = sheet.getRange(1, 1, 1, HEADERS.length);
    hRow.setValues([HEADERS]);
    hRow.setBackground("#2E75B6");
    hRow.setFontColor("#FFFFFF");
    hRow.setFontWeight("bold");
    hRow.setFontFamily("Arial");
    sheet.setFrozenRows(1);
    const widths = [90,80,100,80,180,100,200,120,160,80,80,130,220,80,80,80,80,160,120];
    widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  }

  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const rows = data.rows || [];
  if (rows.length === 0) return { status: "error", message: "Satır verisi boş" };

  const writeRows = rows.map(r => [
    r.date||"", r.vardiya||"", r.grup||"", r.machine||"", r.operator||"",
    r.productCode||"", r.productName||"", r.opCode||"", r.opName||"",
    r.qty||0, r.durusKod||"", r.durusAna||"", r.durusAlt||"",
    r.durusBas||"", r.durusBit||"", r.durusSure||"",
    r.varSure||"", r.not||"", now
  ]);

  sheet.getRange(sheet.getLastRow()+1, 1, writeRows.length, HEADERS.length).setValues(writeRows);
  try { sheet.getFilter()?.remove(); sheet.getRange(1,1,sheet.getLastRow(),HEADERS.length).createFilter(); } catch(e) {}
  return { status: "ok", written: writeRows.length };
}

function buildResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
