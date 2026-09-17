function createRepairOrder(data) {
  data = data || {};
  var customerId = required_(data.CustomerID, 'Customer');
  var motorcycleId = required_(data.MotorcycleID, 'Motorcycle');
  if (!findRecord_('Customers', 'CustomerID', customerId)) throw new Error('Customer not found.');
  var motorcycle = findRecord_('Motorcycles', 'MotorcycleID', motorcycleId);
  if (!motorcycle || motorcycle.CustomerID !== customerId) throw new Error('The selected motorcycle does not belong to this customer.');
  var now = now_();
  var id = nextRepairId_();
  var status = data.Status || 'Received';
  assertOneOf_(status, REPAIR_STATUSES, 'Status');
  var priority = data.Priority || 'Normal';
  assertOneOf_(priority, REPAIR_PRIORITIES, 'Priority');
  var record = {
    RepairID: id, JobNumber: id, CustomerID: customerId, MotorcycleID: motorcycleId,
    CheckInDate: now,
    CustomerComplaint: required_(data.CustomerComplaint, 'Customer complaint'),
    InitialInspection: cleanString_(data.InitialInspection, 5000),
    Diagnosis: cleanString_(data.Diagnosis, 5000),
    AssignedSpecialist: required_(data.AssignedSpecialist, 'Assigned specialist'),
    Priority: priority, Status: status,
    EstimatedCost: cleanNumber_(data.EstimatedCost, 'Estimated cost', true),
    ApprovedCost: cleanNumber_(data.ApprovedCost, 'Approved cost', true),
    FinalCost: cleanNumber_(data.FinalCost, 'Final cost', true),
    EstimatedCompletion: cleanDate_(data.EstimatedCompletion, 'Estimated completion', true),
    ActualCompletion: '',
    CustomerApproval: cleanString_(data.CustomerApproval, 100),
    InternalNotes: cleanString_(data.InternalNotes, 5000),
    CreatedAt: now, UpdatedAt: now
  };
  appendRecord_('RepairOrders', record);
  appendRepairLog_({ RepairID: id, Specialist: record.AssignedSpecialist, Stage: status, WorkPerformed: 'Repair order created', Notes: record.InitialInspection });
  if (data.Mileage !== '' && data.Mileage !== undefined) updateMotorcycle({ MotorcycleID: motorcycleId, Mileage: data.Mileage });
  return getRepairOrder(id);
}

function updateRepairOrder(data) {
  data = data || {};
  var id = required_(data.RepairID, 'Repair ID');
  var current = findRecord_('RepairOrders', 'RepairID', id);
  if (!current) throw new Error('Repair order not found.');
  var allowed = ['CustomerComplaint','InitialInspection','Diagnosis','AssignedSpecialist','Priority','EstimatedCost','ApprovedCost','FinalCost','EstimatedCompletion','ActualCompletion','CustomerApproval','InternalNotes'];
  var changes = { UpdatedAt: now_() };
  allowed.forEach(function(key) {
    if (data[key] === undefined) return;
    if (['EstimatedCost','ApprovedCost','FinalCost'].indexOf(key) !== -1) changes[key] = cleanNumber_(data[key], key, true);
    else if (['EstimatedCompletion','ActualCompletion'].indexOf(key) !== -1) changes[key] = cleanDate_(data[key], key, true);
    else if (key === 'Priority') changes[key] = assertOneOf_(data[key], REPAIR_PRIORITIES, 'Priority');
    else changes[key] = cleanString_(data[key], 5000);
  });
  updateRecord_('RepairOrders', 'RepairID', id, changes);
  if (data.Status && data.Status !== current.Status) return changeRepairStatus(id, data.Status, data.Specialist || current.AssignedSpecialist, data.StatusNotes || 'Status updated');
  return getRepairOrder(id);
}

function deleteRepairOrder(repairId) {
  var id = required_(repairId, 'Repair ID');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var repair = findRecord_('RepairOrders', 'RepairID', id);
    if (!repair) throw new Error('Repair order not found.');

    // Remove dependent workshop history first so no orphan logs or parts remain.
    deleteRowsByField_('RepairLogs', 'RepairID', id);
    deleteRowsByField_('Parts', 'RepairID', id);
    getSpreadsheet_().getSheetByName('RepairOrders').deleteRow(repair._row);
    SpreadsheetApp.flush();

    return { ok: true, RepairID: id, JobNumber: repair.JobNumber || id };
  } finally {
    lock.releaseLock();
  }
}

function deleteRowsByField_(sheetName, field, value) {
  var rows = readSheet_(sheetName).filter(function(row) {
    return String(row[field]) === String(value);
  }).map(function(row) {
    return row._row;
  }).sort(function(a, b) {
    return b - a;
  });
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  rows.forEach(function(rowNumber) { sheet.deleteRow(rowNumber); });
}

function getRepairOrder(repairId) {
  var repair = findRecord_('RepairOrders', 'RepairID', required_(repairId, 'Repair ID'));
  if (!repair) throw new Error('Repair order not found.');
  var result = publicRecord_(repair);
  result.Customer = publicRecord_(findRecord_('Customers', 'CustomerID', repair.CustomerID));
  result.Motorcycle = publicRecord_(findRecord_('Motorcycles', 'MotorcycleID', repair.MotorcycleID));
  result.Logs = getRepairLogs(repairId);
  result.Parts = publicRecords_(readSheet_('Parts').filter(function(p) { return p.RepairID === repairId; }));
  return result;
}

function getRepairOrders(filters) {
  filters = filters || {};
  var customers = readSheet_('Customers');
  var motorcycles = readSheet_('Motorcycles');
  var term = cleanString_(filters.query, 120);
  return publicRecords_(readSheet_('RepairOrders').map(function(r) {
    var c = customers.filter(function(x) { return x.CustomerID === r.CustomerID; })[0] || {};
    var m = motorcycles.filter(function(x) { return x.MotorcycleID === r.MotorcycleID; })[0] || {};
    r.CustomerName = c.FullName || 'Unknown'; r.CustomerPhone = c.PrimaryPhone || '';
    r.MotorcycleModel = m.Model || 'Unknown'; r.PlateNumber = m.PlateNumber || ''; r.VIN = m.VIN || '';
    return r;
  }).filter(function(r) {
    if (filters.status && r.Status !== filters.status) return false;
    if (filters.specialist && r.AssignedSpecialist !== filters.specialist) return false;
    if (filters.priority && r.Priority !== filters.priority) return false;
    if (filters.date && String(r.CheckInDate).slice(0,10) !== String(filters.date).slice(0,10)) return false;
    return !term || includesTerm_([r.JobNumber,r.CustomerName,r.CustomerPhone,r.MotorcycleModel,r.PlateNumber,r.VIN], term);
  }).sort(function(a,b) { return new Date(b.UpdatedAt) - new Date(a.UpdatedAt); }));
}

function searchRepairs(query) { return getRepairOrders({ query: query }); }

function addRepairLog(data) {
  data = data || {};
  var repairId = required_(data.RepairID, 'Repair ID');
  var repair = findRecord_('RepairOrders', 'RepairID', repairId);
  if (!repair) throw new Error('Repair order not found.');
  var stage = data.Stage || repair.Status;
  assertOneOf_(stage, REPAIR_STATUSES, 'Stage');
  var stageChanged = stage !== repair.Status;
  var workPerformed = cleanString_(data.WorkPerformed, 5000);
  if (stageChanged) workPerformed = repair.Status + ' → ' + stage + (workPerformed ? '\n' + workPerformed : '');
  var partsSummary = cleanString_(data.PartsUsed, 2000);
  if (!partsSummary && data.Parts && data.Parts.length) {
    partsSummary = data.Parts.map(function(part) { return cleanString_(part.PartName, 200) + ' × ' + cleanNumber_(part.Quantity, 'Part quantity', false); }).join(', ');
  }
  var log = appendRepairLog_({
    RepairID: repairId, Specialist: required_(data.Specialist || repair.AssignedSpecialist, 'Specialist'), Stage: stage,
    WorkPerformed: workPerformed, Finding: cleanString_(data.Finding, 5000),
    PartsUsed: partsSummary, LaborHours: cleanNumber_(data.LaborHours, 'Labor hours', true),
    Notes: cleanString_(data.Notes, 5000), NextAction: cleanString_(data.NextAction, 2000)
  });
  var changes = { UpdatedAt: now_() };
  if (stageChanged) changes.Status = stage;
  if (stage === 'Delivered') changes.ActualCompletion = now_();
  updateRecord_('RepairOrders', 'RepairID', repairId, changes);
  if (data.Parts && data.Parts.length) data.Parts.forEach(function(part) { addPartUsage_(repairId, part, data.Specialist || repair.AssignedSpecialist); });
  return { log: publicRecord_(log), repair: getRepairOrder(repairId) };
}

function appendRepairLog_(data) {
  var record = {
    LogID: nextSequentialId_('RepairLogs', 'LogID', 'LOG-', 6), RepairID: data.RepairID, Timestamp: now_(),
    Specialist: cleanString_(data.Specialist, 160), Stage: cleanString_(data.Stage, 100),
    WorkPerformed: cleanString_(data.WorkPerformed, 5000), Finding: cleanString_(data.Finding, 5000),
    PartsUsed: cleanString_(data.PartsUsed, 2000), LaborHours: data.LaborHours === undefined ? '' : data.LaborHours,
    Notes: cleanString_(data.Notes, 5000), NextAction: cleanString_(data.NextAction, 2000)
  };
  appendRecord_('RepairLogs', record);
  return record;
}

function getRepairLogs(repairId) {
  return publicRecords_(readSheet_('RepairLogs').filter(function(row) { return row.RepairID === repairId; })
    .sort(function(a,b) { return new Date(b.Timestamp) - new Date(a.Timestamp); }));
}

function changeRepairStatus(repairId, status, specialist, notes) {
  assertOneOf_(status, REPAIR_STATUSES, 'Status');
  var repair = findRecord_('RepairOrders', 'RepairID', repairId);
  if (!repair) throw new Error('Repair order not found.');
  if (repair.Status === status) return getRepairOrder(repairId);
  appendRepairLog_({ RepairID: repairId, Specialist: required_(specialist || repair.AssignedSpecialist, 'Specialist'), Stage: status, WorkPerformed: repair.Status + ' → ' + status, Notes: cleanString_(notes, 5000) });
  var changes = { Status: status, UpdatedAt: now_() };
  if (status === 'Delivered') changes.ActualCompletion = now_();
  updateRecord_('RepairOrders', 'RepairID', repairId, changes);
  return getRepairOrder(repairId);
}

function addPartUsage_(repairId, part, installedBy) {
  var qty = cleanNumber_(part.Quantity, 'Part quantity', false);
  var price = cleanNumber_(part.UnitPrice, 'Unit price', false);
  var record = {
    PartUsageID: nextSequentialId_('Parts', 'PartUsageID', 'PART-', 6), RepairID: repairId,
    PartName: required_(part.PartName, 'Part name'), PartNumber: cleanString_(part.PartNumber, 100),
    Quantity: qty, UnitPrice: price, TotalPrice: qty * price,
    InstalledBy: cleanString_(installedBy, 160), InstalledAt: now_()
  };
  appendRecord_('Parts', record);
  return record;
}

function getCustomerRepairHistory(customerId) { return getRepairOrders({}).filter(function(r) { return r.CustomerID === customerId; }); }
function getMotorcycleRepairHistory(motorcycleId) { return getRepairOrders({}).filter(function(r) { return r.MotorcycleID === motorcycleId; }); }

function getDashboardStats() {
  var repairs = getRepairOrders({});
  var active = repairs.filter(function(r) { return ['Delivered','Cancelled'].indexOf(r.Status) === -1; });
  var now = new Date();
  var startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var count = function(status) { return repairs.filter(function(r) { return r.Status === status; }).length; };
  var attention = active.filter(function(r) {
    var age = now - new Date(r.UpdatedAt);
    return (r.Status === 'Waiting for Customer Approval' && age > 86400000) || r.Status === 'Waiting for Parts' || (r.EstimatedCompletion && new Date(r.EstimatedCompletion) < now);
  }).map(function(r) {
    r.AttentionReason = r.Status === 'Waiting for Parts' ? 'Waiting for parts' : (r.Status === 'Waiting for Customer Approval' ? 'Approval pending over 24 hours' : 'Estimated completion has passed');
    return r;
  });
  return {
    metrics: { active: active.length, inProgress: count('Repair in Progress'), waitingApproval: count('Waiting for Customer Approval'), waitingParts: count('Waiting for Parts'), readyPickup: count('Ready for Pickup'), completedMonth: repairs.filter(function(r) { return r.Status === 'Delivered' && new Date(r.ActualCompletion || r.UpdatedAt) >= startMonth; }).length },
    recent: repairs.slice(0, 8), attention: attention.slice(0, 8)
  };
}
