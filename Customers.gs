function createCustomer(data) {
  data = data || {};
  var phone = cleanPhone_(required_(data.PrimaryPhone, 'Primary phone'));
  var existing = findCustomerByPhone(phone);
  if (existing) throw new Error('A customer with this phone number already exists.');
  var now = now_();
  var record = {
    CustomerID: nextSequentialId_('Customers', 'CustomerID', 'CUS-', 6),
    FullName: required_(data.FullName, 'Full name'),
    PrimaryPhone: phone,
    SecondaryPhone: cleanPhone_(data.SecondaryPhone),
    Email: cleanString_(data.Email, 160),
    Address: cleanString_(data.Address, 500),
    Notes: cleanString_(data.Notes, 2000),
    CreatedAt: now,
    UpdatedAt: now
  };
  appendRecord_('Customers', record);
  return publicRecord_(record);
}

function updateCustomer(data) {
  data = data || {};
  var id = required_(data.CustomerID, 'Customer ID');
  var current = findRecord_('Customers', 'CustomerID', id);
  if (!current) throw new Error('Customer not found.');
  var phone = cleanPhone_(required_(data.PrimaryPhone !== undefined ? data.PrimaryPhone : current.PrimaryPhone, 'Primary phone'));
  var duplicate = readSheet_('Customers').filter(function(row) { return row.CustomerID !== id && normalizePhone_(row.PrimaryPhone) === normalizePhone_(phone); })[0];
  if (duplicate) throw new Error('Another customer already uses this phone number.');
  var changes = {
    FullName: required_(data.FullName !== undefined ? data.FullName : current.FullName, 'Full name'),
    PrimaryPhone: phone,
    SecondaryPhone: cleanPhone_(data.SecondaryPhone !== undefined ? data.SecondaryPhone : current.SecondaryPhone),
    Email: cleanString_(data.Email !== undefined ? data.Email : current.Email, 160),
    Address: cleanString_(data.Address !== undefined ? data.Address : current.Address, 500),
    Notes: cleanString_(data.Notes !== undefined ? data.Notes : current.Notes, 2000),
    UpdatedAt: now_()
  };
  return publicRecord_(updateRecord_('Customers', 'CustomerID', id, changes));
}

function findCustomerByPhone(phone) {
  var normalized = normalizePhone_(phone);
  if (!normalized) return null;
  var customer = readSheet_('Customers').filter(function(row) {
    return normalizePhone_(row.PrimaryPhone) === normalized || normalizePhone_(row.SecondaryPhone) === normalized;
  })[0];
  if (!customer) return null;
  var result = publicRecord_(customer);
  result.RepairCount = readSheet_('RepairOrders').filter(function(row) { return row.CustomerID === customer.CustomerID; }).length;
  return result;
}

function searchCustomers(query) {
  var customers = readSheet_('Customers');
  var motorcycles = readSheet_('Motorcycles');
  var repairs = readSheet_('RepairOrders');
  var term = cleanString_(query, 120);
  return publicRecords_(customers.filter(function(c) {
    return !term || includesTerm_([c.CustomerID,c.FullName,c.PrimaryPhone,c.SecondaryPhone,c.Email], term);
  }).map(function(c) {
    c.MotorcycleCount = motorcycles.filter(function(m) { return m.CustomerID === c.CustomerID; }).length;
    var history = repairs.filter(function(r) { return r.CustomerID === c.CustomerID; }).sort(function(a,b) { return new Date(b.UpdatedAt) - new Date(a.UpdatedAt); });
    c.RepairCount = history.length;
    c.LastVisit = history.length ? history[0].UpdatedAt : '';
    return c;
  }).sort(function(a,b) { return String(a.FullName).localeCompare(String(b.FullName)); }));
}

function getCustomer(customerId) {
  var customer = findRecord_('Customers', 'CustomerID', required_(customerId, 'Customer ID'));
  if (!customer) throw new Error('Customer not found.');
  var result = publicRecord_(customer);
  result.Motorcycles = getCustomerMotorcycles(customerId);
  result.Repairs = getCustomerRepairHistory(customerId);
  return result;
}
