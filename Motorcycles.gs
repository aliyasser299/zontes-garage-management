function createMotorcycle(data) {
  data = data || {};
  var customerId = required_(data.CustomerID, 'Customer');
  if (!findRecord_('Customers', 'CustomerID', customerId)) throw new Error('Customer not found.');
  var vin = cleanString_(data.VIN, 80);
  var plate = cleanString_(data.PlateNumber, 40);
  var duplicate = readSheet_('Motorcycles').filter(function(m) {
    return (vin && String(m.VIN).toLowerCase() === vin.toLowerCase()) || (plate && String(m.PlateNumber).toLowerCase() === plate.toLowerCase());
  })[0];
  if (duplicate) throw new Error('A motorcycle with this VIN or plate number already exists.');
  var now = now_();
  var record = {
    MotorcycleID: nextSequentialId_('Motorcycles', 'MotorcycleID', 'MOTO-', 6),
    CustomerID: customerId,
    Model: required_(data.Model, 'Motorcycle model'),
    ModelYear: cleanString_(data.ModelYear, 4),
    PlateNumber: plate,
    VIN: vin,
    EngineNumber: cleanString_(data.EngineNumber, 80),
    Color: cleanString_(data.Color, 50),
    Mileage: cleanNumber_(data.Mileage, 'Mileage', true),
    Notes: cleanString_(data.Notes, 2000),
    CreatedAt: now,
    UpdatedAt: now
  };
  appendRecord_('Motorcycles', record);
  return publicRecord_(record);
}

function updateMotorcycle(data) {
  data = data || {};
  var id = required_(data.MotorcycleID, 'Motorcycle ID');
  var current = findRecord_('Motorcycles', 'MotorcycleID', id);
  if (!current) throw new Error('Motorcycle not found.');
  var changes = {
    Model: required_(data.Model !== undefined ? data.Model : current.Model, 'Motorcycle model'),
    ModelYear: cleanString_(data.ModelYear !== undefined ? data.ModelYear : current.ModelYear, 4),
    PlateNumber: cleanString_(data.PlateNumber !== undefined ? data.PlateNumber : current.PlateNumber, 40),
    VIN: cleanString_(data.VIN !== undefined ? data.VIN : current.VIN, 80),
    EngineNumber: cleanString_(data.EngineNumber !== undefined ? data.EngineNumber : current.EngineNumber, 80),
    Color: cleanString_(data.Color !== undefined ? data.Color : current.Color, 50),
    Mileage: cleanNumber_(data.Mileage !== undefined ? data.Mileage : current.Mileage, 'Mileage', true),
    Notes: cleanString_(data.Notes !== undefined ? data.Notes : current.Notes, 2000),
    UpdatedAt: now_()
  };
  return publicRecord_(updateRecord_('Motorcycles', 'MotorcycleID', id, changes));
}

function getMotorcycle(motorcycleId) {
  var motorcycle = findRecord_('Motorcycles', 'MotorcycleID', required_(motorcycleId, 'Motorcycle ID'));
  if (!motorcycle) throw new Error('Motorcycle not found.');
  var result = publicRecord_(motorcycle);
  result.Owner = publicRecord_(findRecord_('Customers', 'CustomerID', motorcycle.CustomerID));
  result.Repairs = getMotorcycleRepairHistory(motorcycleId);
  return result;
}

function getCustomerMotorcycles(customerId) {
  return publicRecords_(readSheet_('Motorcycles').filter(function(row) { return row.CustomerID === customerId; }));
}

function searchMotorcycles(query) {
  var term = cleanString_(query, 120);
  var customers = readSheet_('Customers');
  return publicRecords_(readSheet_('Motorcycles').map(function(m) {
    var owner = customers.filter(function(c) { return c.CustomerID === m.CustomerID; })[0];
    m.OwnerName = owner ? owner.FullName : 'Unknown';
    m.OwnerPhone = owner ? owner.PrimaryPhone : '';
    return m;
  }).filter(function(m) {
    return !term || includesTerm_([m.MotorcycleID,m.Model,m.PlateNumber,m.VIN,m.OwnerName,m.OwnerPhone], term);
  }).sort(function(a,b) { return String(a.Model).localeCompare(String(b.Model)); }));
}
