function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Zontes Garage')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function includeScript(filename) {
  return '*/\n' + HtmlService.createHtmlOutputFromFile(filename).getContent() + '\n/*';
}

function setSpreadsheetId(spreadsheetId) {
  if (!spreadsheetId || !String(spreadsheetId).trim()) throw new Error('A spreadsheet ID is required.');
  ScriptProperties.setProperty('SPREADSHEET_ID', String(spreadsheetId).trim());
  return { ok: true };
}

function getBootstrapData() {
  ensureDatabase_();
  return {
    dashboard: getDashboardStats(),
    repairs: getRepairOrders({}),
    customers: searchCustomers(''),
    motorcycles: searchMotorcycles(''),
    statuses: REPAIR_STATUSES,
    priorities: REPAIR_PRIORITIES
  };
}

function globalSearch(query) {
  var term = cleanString_(query, 120);
  if (!term) return { customers: [], motorcycles: [], repairs: [] };
  return {
    customers: searchCustomers(term).slice(0, 8),
    motorcycles: searchMotorcycles(term).slice(0, 8),
    repairs: searchRepairs(term).slice(0, 8)
  };
}
