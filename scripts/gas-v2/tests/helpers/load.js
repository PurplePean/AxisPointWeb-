'use strict';

/*
 * Loads scripts/gas-v2/src into one VM context.
 *
 * WHY A SINGLE SHARED CONTEXT. Apps Script concatenates every pushed file into one
 * global scope; there are no modules and no imports. Loading each file into its own
 * sandbox would test a structure that does not exist in production. So the loader
 * reproduces the real thing: every src file, evaluated in order, in one global.
 *
 * WHY THE FILE LIST IS DISCOVERED, NOT HARD-CODED. A hard-coded list silently stops
 * covering a new module the moment someone adds one. The loader reads the directory
 * and asserts the set is non-empty.
 *
 * WHY THE WALK RECURSES. src is grouped into entrypoints/, core/, platform/, scheduled/,
 * emails/, and shared/. Those folders are a reading aid for humans only: Apps Script
 * still flattens everything into one global scope, so the loader must reach every file at
 * every depth. A non-recursive read would silently load nothing and report an empty set.
 * Returned names are paths relative to src, with forward slashes, so a caller can print
 * `emails/Registry.js` rather than an ambiguous bare `Registry.js`.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

function listSourceFiles(dir = SRC_DIR, prefix = '') {
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSourceFiles(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith('.js')) out.push(rel);
  });
  return out.sort();
}

/**
 * Builds a context with only the globals Apps Script actually provides. Node-only
 * globals (require, module, process, Buffer) are deliberately absent: if src ever
 * starts depending on one, these tests fail here rather than in production.
 */
function load(googleStubs = {}) {
  const sandbox = {
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    isNaN,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    ...googleStubs,
  };

  const context = vm.createContext(sandbox);
  const files = listSourceFiles();
  if (files.length === 0) throw new Error('no source files found in scripts/gas-v2/src');

  for (const file of files) {
    const code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    vm.runInContext(code, context, { filename: `gas-v2/src/${file}` });
  }

  return context;
}

module.exports = { load, listSourceFiles, SRC_DIR };
