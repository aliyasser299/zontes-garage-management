var SHEETS = {
  Customers: ['CustomerID','FullName','PrimaryPhone','SecondaryPhone','Email','Address','Notes','CreatedAt','UpdatedAt'],
  Motorcycles: ['MotorcycleID','CustomerID','Model','ModelYear','PlateNumber','VIN','EngineNumber','Color','Mileage','Notes','CreatedAt','UpdatedAt'],
  RepairOrders: ['RepairID','JobNumber','CustomerID','MotorcycleID','CheckInDate','CustomerComplaint','InitialInspection','Diagnosis','AssignedSpecialist','Priority','Status','EstimatedCost','ApprovedCost','FinalCost','EstimatedCompletion','ActualCompletion','CustomerApproval','InternalNotes','CreatedAt','UpdatedAt'],
  RepairLogs: ['LogID','RepairID','Timestamp','Specialist','Stage','WorkPerformed','Finding','PartsUsed','LaborHours','Notes','NextAction'],
  Parts: ['PartUsageID','RepairID','PartName','PartNumber','Quantity','UnitPrice','TotalPrice','InstalledBy','InstalledAt'],
  Settings: ['Key','Value']
};

var REPAIR_STATUSES = ['Received','Initial Inspection','Diagnosis','Waiting for Customer Approval','Approved','Repair in Progress','Waiting for Parts','Quality Check','Ready for Pickup','Delivered','Cancelled'];
var REPAIR_PRIORITIES = ['Normal','High','Urgent'];
var ScriptProperties = PropertiesService.getScriptProperties();

function getSpreadsheet_() {
  var id = ScriptProperties.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No spreadsheet is configured. Set the SPREADSHEET_ID script property or bind this project to a Google Sheet.');
  return active;
}

function setupDatabase() {
  var ss = getSpreadsheet_();
  Object.keys(SHEETS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = SHEETS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (existing.join('|') !== headers.join('|')) {
        throw new Error('The ' + name + ' sheet headers do not match the application schema.');
      }
    }
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f4f8fb');
  });
  var settings = ss.getSheetByName('Settings');
  if (settings.getLastRow() === 1) settings.appendRow(['GarageName', 'Zontes Garage']);
  return { ok: true, spreadsheetName: ss.getName() };
}

function ensureDatabase_() {
  var ss = getSpreadsheet_();
  if (!ss.getSheetByName('Customers')) setupDatabase();
}

function readSheet_(name) {
  ensureDatabase_();
  var sheet = getSpreadsheet_().getSheetByName(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).filter(function(row) { return row.some(function(v) { return v !== ''; }); }).map(function(row, index) {
    var item = { _row: index + 2 };
    headers.forEach(function(header, i) { item[header] = row[i]; });
    return item;
  });
}

function appendRecord_(name, record) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  var row = SHEETS[name].map(function(key) { return record[key] === undefined ? '' : record[key]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return record;
}

function updateRecord_(name, idField, id, changes) {
  var records = readSheet_(name);
  var record = records.filter(function(item) { return item[idField] === id; })[0];
  if (!record) throw new Error(name.replace(/s$/, '') + ' not found.');
  var merged = {};
  SHEETS[name].forEach(function(key) { merged[key] = changes[key] !== undefined ? changes[key] : record[key]; });
  getSpreadsheet_().getSheetByName(name).getRange(record._row, 1, 1, SHEETS[name].length)
    .setValues([SHEETS[name].map(function(key) { return merged[key]; })]);
  return merged;
}

function findRecord_(name, field, value) {
  return readSheet_(name).filter(function(row) { return String(row[field]) === String(value); })[0] || null;
}

function nextSequentialId_(sheetName, field, prefix, width) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var values = readSheet_(sheetName);
    var sheetMax = values.reduce(function(current, row) {
      var match = String(row[field] || '').match(/(\d+)$/);
      return match ? Math.max(current, Number(match[1])) : current;
    }, 0);
    var counterKey = 'ID_COUNTER_' + sheetName + '_' + field + '_' + prefix;
    var reservedMax = Number(ScriptProperties.getProperty(counterKey) || 0);
    var next = Math.max(sheetMax, reservedMax) + 1;
    // Reserving the number while holding the lock keeps it unique even though
    // the record append happens after the generator returns.
    ScriptProperties.setProperty(counterKey, String(next));
    return prefix + String(next).padStart(width || 6, '0');
  } finally {
    lock.releaseLock();
  }
}

function nextRepairId_() {
  var year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
  return nextSequentialId_('RepairOrders', 'RepairID', 'ZG-' + year + '-', 6);
}

function serializeValue_(value) {
  return value instanceof Date ? value.toISOString() : value;
}
