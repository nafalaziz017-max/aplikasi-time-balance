/**
 * TimeBalance — penerima bukti bayar (Google Apps Script).
 * Foto yang dikirim server TimeBalance disimpan otomatis ke folder Google Drive-mu.
 *
 * Pengaturan (Project Settings → Script properties):
 *   FOLDER_ID : ID folder Drive tujuan (bagian terakhir alamat folder)
 *   SECRET    : sandi rahasia yang SAMA dengan secret PROOF_SECRET di GitHub
 */
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var body = JSON.parse(e.postData.contents);
    var secret = props.getProperty('SECRET');
    if (!secret || body.secret !== secret) return out_({ ok: false, error: 'secret salah' });
    if (!/^image\/(jpeg|png|webp)$/.test(String(body.mime))) return out_({ ok: false, error: 'format tidak didukung' });
    var folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
    var name = String(body.filename || 'bukti').replace(/[^\w.@-]/g, '_').slice(0, 120);
    var blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.mime, name);
    var file = folder.createFile(blob);
    return out_({ ok: true, url: file.getUrl() });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
