// Minimal fixed-width table printer so read-only scripts produce readable,
// aligned output without any dependency.

// rows: array of objects. columns: array of { key, label } (label optional).
function printTable(rows, columns) {
  const cols = columns.map((c) => ({
    key: c.key,
    label: c.label || c.key,
  }));

  if (!rows.length) {
    console.log('(no rows)');
    return;
  }

  const cell = (row, key) => {
    const v = row[key];
    return v === undefined || v === null ? '' : String(v);
  };

  const widths = cols.map((c) =>
    Math.max(c.label.length, ...rows.map((r) => cell(r, c.key).length))
  );

  const pad = (str, width) => str + ' '.repeat(width - str.length);

  const header = cols.map((c, i) => pad(c.label, widths[i])).join('  ');
  const rule = widths.map((w) => '-'.repeat(w)).join('  ');
  console.log(header);
  console.log(rule);
  for (const row of rows) {
    console.log(cols.map((c, i) => pad(cell(row, c.key), widths[i])).join('  '));
  }
}

module.exports = { printTable };
