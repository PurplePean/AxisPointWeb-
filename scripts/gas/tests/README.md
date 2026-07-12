# GAS backend tests

Committed test suite for `scripts/gas/Code.gs`. Run from the repo root:

```
pnpm test:gas
```

Uses Node's built-in test runner (`node --test`); no test framework dependency.

## What's covered

- **`pure-functions.test.js`** — the GAS-runtime-independent functions of
  `Code.gs`, exercised against the real file (see loading below), not
  reimplementations.
- **`template-parity.test.js`** — every embedded `TEMPLATE_*` constant (what
  Apps Script actually renders) byte-matches its `../emails/*.html` mirror.
- **`slots-sync.test.js`** — backend `BOOKING_SLOTS` equals frontend `SLOTS` in
  `packages/brand/.../form/utils.ts`.

## How the real Code.gs is loaded

`Code.gs` is not a module; it declares everything at top level with `var` /
`function`, the way Apps Script expects. `helpers/load-code.js` runs the real
file in a Node `vm` context with the Google services stubbed, so those top-level
declarations become properties of the returned sandbox. Tests call the actual
production functions.

Two things to know when adding tests:

1. **Arrays returned from the sandbox live in the vm realm.** Their prototype is
   the sandbox's `Array`, not the host's, so `assert.deepEqual(sandboxArray,
   [...])` fails on the prototype even when contents match. Wrap with
   `Array.from(...)` first. (Primitive strings/numbers inside are realm-agnostic,
   so element-wise `assert.equal` is fine.)

2. **Never build a Sheet-header fixture from `LEAD_HEADERS`.** This is the lesson
   from the 2026-07-08 header-corruption incident: the earlier throwaway harness
   constructed its header rows from the same constant the code read, so a
   positional bug was invisible to it. Any fixture standing in for a live header
   row must be hand-written and deliberately different (reordered, re-cased,
   whitespace-mangled), and asserted `notDeepEqual` to `LEAD_HEADERS` where it
   matters.
