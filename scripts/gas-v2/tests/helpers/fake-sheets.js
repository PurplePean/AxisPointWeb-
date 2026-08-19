'use strict';

/*
 * A spreadsheet fake with just enough surface for the repository adapters:
 * getDataRange().getValues(), appendRow(), getRange(row, col).setValue().
 *
 * It is a real grid, not a recorder. Tests assert on what ended up in which cell,
 * which is the thing that actually goes wrong when a header moves.
 */

class FakeRange {
  constructor(sheet, row, col) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
  }

  setValue(value) {
    this.sheet.setCell(this.row, this.col, value);
    return this;
  }

  getValue() {
    return this.sheet.getCell(this.row, this.col);
  }

  getValues() {
    return this.sheet.grid.map((r) => r.slice());
  }
}

class FakeSheet {
  constructor(name, grid) {
    this.name = name;
    this.grid = (grid || []).map((r) => r.slice());
    this.appended = 0;
  }

  getName() {
    return this.name;
  }

  getDataRange() {
    const sheet = this;
    return {
      getValues() {
        return sheet.grid.map((r) => r.slice());
      },
    };
  }

  appendRow(row) {
    this.appended += 1;
    // Array.from normalizes VM-realm arrays to Node.js-realm so that assert.deepEqual
    // does not fail on a prototype mismatch when tests compare headers to JS literals.
    const native = Array.from(row);
    const width = this.grid.length > 0 ? this.grid[0].length : native.length;
    const padded = native.slice(0, width);
    while (padded.length < width) padded.push('');
    this.grid.push(padded);
    return this;
  }

  getRange(row, col) {
    return new FakeRange(this, row, col);
  }

  setCell(row, col, value) {
    while (this.grid.length < row) this.grid.push(new Array(this.grid[0] ? this.grid[0].length : 0).fill(''));
    const target = this.grid[row - 1];
    while (target.length < col) target.push('');
    target[col - 1] = value;
  }

  getCell(row, col) {
    const target = this.grid[row - 1];
    return target ? target[col - 1] : undefined;
  }

  /** Records keyed by the sheet's own header row, for readable assertions. */
  records() {
    if (this.grid.length === 0) return [];
    const headers = this.grid[0];
    return this.grid.slice(1).map((row) => {
      const out = {};
      headers.forEach((h, i) => {
        out[h] = row[i];
      });
      return out;
    });
  }
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = sheets || {};
    this.insertedSheets = [];
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  /** Creates a new empty tab and returns it. Matches the SpreadsheetApp.insertSheet() contract. */
  insertSheet(name) {
    const sheet = new FakeSheet(name, []);
    this.sheets[name] = sheet;
    this.insertedSheets.push(name);
    return sheet;
  }
}

/** Builds a book whose tabs carry exactly the given header rows. */
function buildBook(layout) {
  const sheets = {};
  layout.forEach((tab) => {
    sheets[tab.name] = new FakeSheet(tab.name, [tab.headers.slice()]);
  });
  return new FakeSpreadsheet(sheets);
}

module.exports = { FakeSheet, FakeSpreadsheet, FakeRange, buildBook };
