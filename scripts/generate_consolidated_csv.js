const fs = require('fs');

const d = JSON.parse(fs.readFileSync('scripts/live_supabase_snapshot.json', 'utf8'));
const map = {};
d.forEach((x) => {
  const m = (x.box_number || '').match(/BOX\s*(\d+)/i);
  if (m) map[parseInt(m[1], 10)] = x;
});

const headers = [
  'Group ID',
  'Box Number',
  'Display Size',
  'Title',
  'Compatible Models',
  'Stock Quantity',
  'Stock Status',
  'Category',
  'Stock Count Verified',
];

const csvEscape = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

const rows = [headers.join(',')];

for (let i = 1; i <= 148; i++) {
  const item = map[i] || {};
  const boxNumPadded = 'BOX ' + String(i).padStart(3, '0');
  const groupId = 'box-' + String(i).padStart(3, '0');
  const displaySize = item.display_size || 'Unknown';
  const title = item.title || 'Screen Guard';
  const models = (item.models || []).map((m) => m.model_name || m).filter(Boolean);
  const compatibleModels = models.length > 0 ? models.join(' | ') : title;

  rows.push(
    [
      csvEscape(groupId),
      csvEscape(boxNumPadded),
      csvEscape(displaySize),
      csvEscape(title),
      csvEscape(compatibleModels),
      0,
      csvEscape('NOT COUNTED'),
      csvEscape('Super-D'),
      csvEscape('NO'),
    ].join(',')
  );
}

fs.writeFileSync('UZEE_TECH_SCREENGUARD_CLEAN_CONSOLIDATED_2026.csv', rows.join('\n'), 'utf8');
console.log('Successfully created UZEE_TECH_SCREENGUARD_CLEAN_CONSOLIDATED_2026.csv (total records: 148)');

