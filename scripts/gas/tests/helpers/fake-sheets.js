'use strict';

/*
 * A minimal but honest in-memory fake of the Apps Script Spreadsheet surface,
 * enough to exercise the live-sheet functions in Code.gs (resolveCols and the
 * functions threaded through it). It models the specific semantics those
 * functions depend on:
 *   - getRange(row, col, numRows, numCols).getValues() / setValue(s)
 *   - getDataRange().getValues()
 *   - getLastRow() / getLastColumn() / getName()
 *   - appendRow(row)
 *   - deleteRow(n)   (1-based, shifts rows up — the semantics moveColdLeads needs)
 *
 * Row/column addressing is 1-based, matching Apps Script. Values are stored as a
 * dense 2D array; ragged input rows are padded so column math stays sane.
 *
 * FakeSheet takes a `grid` INCLUDING its header row as grid[0]. Tests build that
 * header row BY HAND (and, per the suite's fixture rule, deliberately mangle it
 * away from LEAD_HEADERS when proving name-based resolution).
 */

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowArr = [];
      for (let c = 0; c < this.numCols; c++) {
        rowArr.push(this.sheet._get(this.row + r, this.col + c));
      }
      out.push(rowArr);
    }
    return out;
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        this.sheet._set(this.row + r, this.col + c, values[r][c]);
      }
    }
    return this;
  }

  setValue(value) {
    // Applies to every cell in the range (matches Apps Script).
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        this.sheet._set(this.row + r, this.col + c, value);
      }
    }
    return this;
  }

  // Formatting no-ops — present so calls don't throw.
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  clearContent() {
    return this.setValue('');
  }
  clearFormat() { return this; }
  copyFormatToRange() { return this; }
}

class FakeSheet {
  constructor(name, grid) {
    this.name = name;
    // Deep copy so a test's fixture array isn't mutated under it.
    this._grid = (grid || []).map((r) => r.slice());
    this.deletedRows = [];
    this.appended = [];
  }

  getName() {
    return this.name;
  }

  _width() {
    return this._grid.reduce((m, r) => Math.max(m, r.length), 0);
  }

  getLastRow() {
    return this._grid.length;
  }

  getLastColumn() {
    return this._width();
  }

  getMaxColumns() {
    return this._width();
  }

  _get(row, col) {
    const r = this._grid[row - 1];
    if (!r) return '';
    const v = r[col - 1];
    return v === undefined ? '' : v;
  }

  _set(row, col, value) {
    while (this._grid.length < row) this._grid.push([]);
    const r = this._grid[row - 1];
    while (r.length < col) r.push('');
    r[col - 1] = value;
  }

  getRange(row, col, numRows, numCols) {
    if (numRows === undefined) numRows = 1;
    if (numCols === undefined) numCols = 1;
    return new FakeRange(this, row, col, numRows, numCols);
  }

  getDataRange() {
    return new FakeRange(this, 1, 1, this.getLastRow(), Math.max(1, this.getLastColumn()));
  }

  appendRow(row) {
    this._grid.push(row.slice());
    this.appended.push(row.slice());
    return this;
  }

  deleteRow(n) {
    // 1-based; removes the row and shifts everything below up (Apps Script).
    const removed = this._grid.splice(n - 1, 1);
    this.deletedRows.push(n);
    return removed;
  }

  setFrozenRows() { return this; }
  insertColumnsAfter() { return this; }
  insertColumnBefore() { return this; }
}

class FakeSpreadsheet {
  constructor(sheetsByName) {
    this._sheets = sheetsByName || {};
  }
  getSheetByName(name) {
    return this._sheets[name] || null;
  }
  insertSheet(name) {
    const s = new FakeSheet(name, []);
    this._sheets[name] = s;
    return s;
  }
}

module.exports = { FakeSheet, FakeSpreadsheet, FakeRange };
