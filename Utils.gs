function now_() { return new Date(); }

function cleanString_(value, maxLength) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength || 5000);
}

function required_(value, label) {
  var result = cleanString_(value);
  if (!result) throw new Error(label + ' is required.');
  return result;
}

function cleanPhone_(value) {
  var phone = cleanString_(value, 30);
  if (phone && phone.replace(/\D/g, '').length < 7) throw new Error('Enter a valid phone number.');
  return phone;
}

function normalizePhone_(value) { return String(value || '').replace(/\D/g, ''); }

function cleanNumber_(value, label, allowBlank) {
  if ((value === '' || value === null || value === undefined) && allowBlank) return '';
  var number = Number(value);
  if (!isFinite(number) || number < 0) throw new Error((label || 'Value') + ' must be a positive number.');
  return number;
}

function cleanDate_(value, label, allowBlank) {
  if (!value && allowBlank) return '';
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw new Error((label || 'Date') + ' is invalid.');
  return date;
}

function assertOneOf_(value, values, label) {
  if (values.indexOf(value) === -1) throw new Error((label || 'Value') + ' is invalid.');
  return value;
}

function includesTerm_(values, term) {
  var needle = String(term || '').toLowerCase();
  return values.some(function(value) { return String(value || '').toLowerCase().indexOf(needle) !== -1; });
}

function publicRecord_(record) {
  if (!record) return null;
  var copy = {};
  Object.keys(record).forEach(function(key) { if (key !== '_row') copy[key] = serializeValue_(record[key]); });
  return copy;
}

function publicRecords_(records) { return records.map(publicRecord_); }
