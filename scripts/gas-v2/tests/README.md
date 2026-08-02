# scripts/gas-v2/tests

Node's built-in test runner against the real `src` files. No dependencies, no build.

```
pnpm test:gas-v2
```

## How loading works

`helpers/load.js` reads every `src/*.js` file and evaluates it in ONE VM context. That
reproduces the Apps Script runtime, which concatenates all pushed files into a single
global scope with no modules and no imports. Loading each file into its own sandbox
would test a structure that does not exist in production.

The context is supplied with only the globals Apps Script provides. `require`,
`module`, `process`, and `Buffer` are deliberately absent, so a Node dependency
creeping into `src` fails at load rather than after a push.

The file list is discovered from the directory, never hard-coded, so a new module is
covered by the deployability checks the moment it is added.

## Fixture rule

Fixtures and expected values are HAND-TYPED, deliberately not derived from the
constants under test. A fixture built from `LEAD_HEADERS` proves only that the constant
equals itself. `sheet-repository.test.js` goes further and mangles its header row on
purpose (reordered, re-cased, whitespace-padded, with an extra human column) because
the failure it guards is a real person dragging a column in the live Sheet.

## What each suite guards

| Suite | The silent failure it exists to catch |
|---|---|
| `tokens.test.js` | A renamed wire token orphaning every historical row that used the old one, with no error anywhere. |
| `contract.test.js` | A display string accepted as a wire value (making the copy deck the contract), a client setting its own server-owned field, or a pathway accepting another pathway's blocks. |
| `spam.test.js` | A real owner inquiry being discarded. Screening must flag and never drop, and a client-supplied signal must never be able to clear a flag. |
| `matching.test.js` | An automatic merge of two people who share a name. Unrecoverable through normal use, and nobody finds out. |
| `sla.test.js` | Wall-clock deadlines marking every evening and weekend lead breached before anyone could answer, making the field meaningless. |
| `domain.test.js` | The Lead/Contact split collapsing, and a second submission erasing what the first recorded. |
| `routing.test.js` | A QR scan being treated as an ownership assignment, or a notification reaching nobody. |
| `intake.test.js` | A double-clicked submit creating two leads; storage happening after a side effect; personal data reaching the log. |
| `worker.test.js` | An unbounded retry emailing somebody every five minutes forever, and the at-least-once guarantee being quietly overstated. |
| `booking.test.js` | A calendar conflict rejecting an inquiry, a duplicate hold, or a superseded booking landing anyway. |
| `entry.test.js` | An internal value (Sheet id, address, stack) crossing the boundary, and an uncaught exception returning unreadable HTML instead of JSON. |
| `sheet-repository.test.js` | Position-based column access writing values into the wrong columns after somebody reorders the Sheet. |
| `deployability.test.js` | A pushed test file taking the whole backend down, a load-order dependency, or an environment value committed to the repository. |

## Helpers

| File | Purpose |
|---|---|
| `load.js` | Single-context loader; also exports the discovered source list. |
| `fakes.js` | In-memory ports. Fakes, not mocks: they really store, so tests assert outcomes rather than call counts. |
| `fake-sheets.js` | A real grid implementing the small slice of the Sheet API the adapters use. |
| `fixtures.js` | Hand-written envelopes for all three submission kinds and a booking request. |

Ids in `fakes.js` are deterministic but still UUID-shaped, because `leadId` is a UUID
on the wire and the booking command validates it as one.
