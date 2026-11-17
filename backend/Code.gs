/**
 * Legendary Kits POS: the Google Sheets backend.
 *
 * Paste this whole file into Extensions > Apps Script of your Google Sheet (see SETUP-GUIDE.md).
 * Each table is one tab. Every row keeps the full record in the last column ("json") so nothing is lost;
 * the other columns are there for you to read and filter in the Sheet. Pictures are kept in a Google Drive
 * folder, not inside the Sheet. A copy of the Sheet is saved to a Backups folder every night (last 30 kept).
 */

var TABLES = {
  products: ['name', 'code', 'category', 'price', 'cost', 'sizes', 'picture', 'active'],
  patches: ['name', 'price', 'cost', 'picture', 'active'],
  accounts: ['name', 'type', 'openingBalance', 'active'],
  customers: ['name', 'phone', 'notes'],
  sales: ['date', 'time', 'number', 'customerName', 'items', 'total', 'paid', 'onAccount', 'status'],
  payments: ['date', 'number', 'customerName', 'orderId', 'amount', 'accountId'],
  expenses: ['date', 'number', 'category', 'description', 'amount', 'accountId'],
  transfers: ['date', 'number', 'fromId', 'toId', 'amount', 'note'],
  salesOrders: ['date', 'number', 'customerName', 'phone', 'status', 'items', 'total'],
  supplierOrders: ['date', 'number', 'supplier', 'status', 'items', 'total'],
};
/** Tables that grow every day: a device first loads only recent rows of these. */
var HISTORY = ['sales', 'payments', 'expenses', 'transfers'];
var FIXED = ['id', 'syncedAt', 'updatedAt', 'deleted'];

/* ---------------- Menu in the Sheet ---------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kits POS')
    .addItem('1. Set up (run once)', 'setup')
    .addItem('Show my key', 'showKey')
    .addItem('Back up now', 'backup')
    .addToUi();
}

/** Creates the tabs, the Drive folders, the key and the nightly backup. Safe to run again. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  Object.keys(TABLES).forEach(function (t) {
    var sh = ss.getSheetByName(t) || ss.insertSheet(t);
    var header = FIXED.concat(TABLES[t], ['json']);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#ededed');
    sh.setFrozenRows(1);
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  if (!props.getProperty('KEY')) props.setProperty('KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  if (!props.getProperty('IMG_FOLDER')) props.setProperty('IMG_FOLDER', DriveApp.createFolder('Legendary Kits POS – Pictures').getId());
  if (!props.getProperty('BACKUP_FOLDER')) props.setProperty('BACKUP_FOLDER', DriveApp.createFolder('Legendary Kits POS – Backups').getId());
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'backup') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('backup').timeBased().everyDays(1).atHour(2).create();
  SpreadsheetApp.getUi().alert(
    'Set up done.\n\nYour key is:\n\n' + props.getProperty('KEY') + '\n\nNext: Deploy > New deployment > Web app (see the setup guide), then paste the web app address and this key into the app (Settings).'
  );
}

function showKey() {
  SpreadsheetApp.getUi().alert('Your key:\n\n' + PropertiesService.getScriptProperties().getProperty('KEY'));
}

/** A dated copy of the whole Sheet in the Backups folder; copies older than 30 days are removed. */
function backup() {
  var props = PropertiesService.getScriptProperties();
  var folder = DriveApp.getFolderById(props.getProperty('BACKUP_FOLDER'));
  var file = DriveApp.getFileById(props.getProperty('SHEET_ID'));
  file.makeCopy('Kits POS backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'), folder);
  var cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  var old = folder.getFiles();
  while (old.hasNext()) {
    var f = old.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
}

/* ---------------- Web app ---------------- */

function doGet() {
  return out({ ok: true, info: 'Legendary Kits POS backend is running. Open the app to use it.' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('KEY') || req.key !== props.getProperty('KEY')) return out({ ok: false, error: 'Wrong key. Copy it again from the Sheet: Kits POS > Show my key.' });
    switch (req.action) {
      case 'ping':
        return out({ ok: true, sheet: book().getName(), serverTime: new Date().toISOString() });
      case 'push':
        return out(push(req.table, req.records));
      case 'pull':
        return out(pull(req.since || {}, req.from || ''));
      case 'query':
        return out(query(req.table, req.from, req.to));
      case 'uploadImage':
        return out(uploadImage(req.name, req.mime, req.data));
      case 'image':
        return out(image(req.id));
      default:
        return out({ ok: false, error: 'Unknown request.' });
    }
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function book() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
}

function sheetFor(table) {
  if (!TABLES[table]) throw new Error('Unknown table ' + table);
  var sh = book().getSheetByName(table);
  if (!sh) throw new Error('Tab "' + table + '" is missing. Run Kits POS > Set up again.');
  return sh;
}

/** The readable columns for one record. */
function readable(table, r) {
  return TABLES[table].map(function (c) {
    if (c === 'picture') return r.imageId ? '=IMAGE("https://drive.google.com/thumbnail?id=' + r.imageId + '&sz=w200")' : '';
    if (c === 'items') return (r.lines || []).map(function (l) {
      return (l.qty || 0) + ' x ' + (l.name || l.productId || '') + (l.size ? ' ' + l.size : '') + (l.printName ? ' ' + l.printName : '') + (l.printNumber ? ' #' + l.printNumber : '');
    }).join('; ');
    if (c === 'sizes') return (r.sizes || []).join(' ');
    return text(r[c]);
  });
}

/** Text stays text: stops the Sheet turning dates, times, codes and phone numbers into its own formats. */
function text(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && v !== '') return "'" + v;
  return v;
}

/** Saves records (add or replace by id). The newer copy wins if the Sheet already holds a newer one. */
function push(table, records) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = sheetFor(table);
    var width = FIXED.length + TABLES[table].length + 1;
    var last = sh.getLastRow();
    var ids = last > 1 ? sh.getRange(2, 1, last - 1, 3).getValues() : [];
    var rowOf = {};
    ids.forEach(function (r, i) {
      rowOf[r[0]] = { row: i + 2, updatedAt: String(r[2]) };
    });
    var now = new Date().toISOString();
    var appends = [];
    (records || []).forEach(function (r) {
      var values = [text(r.id), text(now), text(r.updatedAt || now), r.deleted ? true : ''].concat(readable(table, r), [text(JSON.stringify(r))]);
      var found = rowOf[r.id];
      if (found) {
        if (String(r.updatedAt || '') >= found.updatedAt) sh.getRange(found.row, 1, 1, width).setValues([values]);
      } else {
        appends.push(values);
        rowOf[r.id] = { row: -1, updatedAt: r.updatedAt };
      }
    });
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, width).setValues(appends);
    return { ok: true, saved: (records || []).length };
  } finally {
    lock.releaseLock();
  }
}

function rowsOf(table) {
  var sh = sheetFor(table);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var width = FIXED.length + TABLES[table].length + 1;
  return sh.getRange(2, 1, last - 1, width).getValues();
}

function parse(row) {
  try {
    return JSON.parse(row[row.length - 1]);
  } catch (e) {
    return null;
  }
}

/**
 * Everything saved since the given times (per table). On a device's first load the growing history tables
 * come only from `from` onward; older rows are fetched with query when someone filters for them.
 */
function pull(since, from) {
  var serverTime = new Date().toISOString();
  var tables = {};
  Object.keys(TABLES).forEach(function (t) {
    var s = since[t] || '';
    var dateCol = FIXED.length + TABLES[t].indexOf('date');
    tables[t] = rowsOf(t)
      .filter(function (r) {
        if (s) return String(r[1]) > s;
        if (HISTORY.indexOf(t) >= 0 && from && dateCol >= FIXED.length) return String(r[dateCol]) >= from;
        return true;
      })
      .map(parse)
      .filter(function (x) {
        return x;
      });
  });
  return { ok: true, tables: tables, serverTime: serverTime };
}

function query(table, from, to) {
  var dateCol = FIXED.length + TABLES[table].indexOf('date');
  var recs = rowsOf(table)
    .filter(function (r) {
      var d = String(r[dateCol]);
      return (!from || d >= from) && (!to || d <= to);
    })
    .map(parse)
    .filter(function (x) {
      return x;
    });
  return { ok: true, records: recs };
}

/** A picture at full quality into the Pictures folder, viewable by anyone with the link (for thumbnails). */
function uploadImage(name, mime, data) {
  var folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('IMG_FOLDER'));
  var blob = Utilities.newBlob(Utilities.base64Decode(data), mime || 'image/jpeg', name || 'picture.jpg');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, id: file.getId() };
}

/** The full-quality picture, for Excel exports and WhatsApp shares. */
function image(id) {
  var blob = DriveApp.getFileById(id).getBlob();
  return { ok: true, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}
