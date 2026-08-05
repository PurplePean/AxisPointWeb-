import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  E2E_WARNING,
  V1_ENDPOINT_VAR,
  V2_ENDPOINT_VAR,
  resolveEndpoint,
} from '../vite.endpoint';

/*
 * Endpoint selection for apps/web.
 *
 * THE POINT OF THESE TESTS. `VITE_FORM_ENDPOINT` names the V1 Apps Script deployment, which
 * speaks a completely different payload shape from V2. If the V2 intake ever inherited it,
 * every submission would be posted to the wrong backend and rejected there, and the symptom
 * would read as a backend bug rather than a configuration mistake. So the V2 name is
 * required, and a lone V1 value is an error rather than a fallback.
 *
 * Every case runs against a TEMPORARY FIXTURE DIRECTORY. The real machine-local
 * `.env.e2e.local` is never read, listed, or executed against, deliberately: it holds a live
 * endpoint, and a test suite is not a reason to touch it.
 */

/** Builds a throwaway env directory. `files` maps a filename to its contents. */
function fixtureDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axp-env-'));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

/**
 * Runs the resolver with the ambient endpoint variables cleared.
 *
 * `loadEnv` merges `process.env` on top of the files, so a value in the developer's shell
 * would otherwise decide the result and the fixture would prove nothing.
 */
function withCleanEnv<T>(fn: () => T): T {
  const saved = {
    [V2_ENDPOINT_VAR]: process.env[V2_ENDPOINT_VAR],
    [V1_ENDPOINT_VAR]: process.env[V1_ENDPOINT_VAR],
  };
  delete process.env[V2_ENDPOINT_VAR];
  delete process.env[V1_ENDPOINT_VAR];
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/* ── Development always simulates ─────────────────────────────────────────── */

test('development forces the endpoint empty even when both variables are set', () => {
  const dir = fixtureDir({
    '.env.local': `${V2_ENDPOINT_VAR}=https://v2.example.test/exec\n${V1_ENDPOINT_VAR}=https://v1.example.test/exec\n`,
  });

  const resolved = resolveEndpoint('development', dir);
  assert.equal(resolved.endpoint, '');
  assert.equal(resolved.e2e, false);
});

test('development ignores a shell endpoint too', () => {
  const dir = fixtureDir({});
  process.env[V2_ENDPOINT_VAR] = 'https://v2.example.test/exec';
  try {
    assert.equal(resolveEndpoint('development', dir).endpoint, '');
  } finally {
    delete process.env[V2_ENDPOINT_VAR];
  }
});

/* ── E2E requires the V2 name ─────────────────────────────────────────────── */

test('e2e uses the V2 endpoint when it is present', () => {
  const dir = fixtureDir({ '.env.e2e.local': `${V2_ENDPOINT_VAR}=https://v2.example.test/exec\n` });

  const resolved = withCleanEnv(() => resolveEndpoint('e2e', dir));
  assert.equal(resolved.endpoint, 'https://v2.example.test/exec');
  assert.equal(resolved.e2e, true);
});

test('e2e FAILS when only the historical V1 variable exists', () => {
  const dir = fixtureDir({ '.env.e2e.local': `${V1_ENDPOINT_VAR}=https://v1.example.test/exec\n` });

  assert.throws(
    () => withCleanEnv(() => resolveEndpoint('e2e', dir)),
    (error: Error) => {
      assert.match(error.message, new RegExp(V2_ENDPOINT_VAR));
      // It must say WHY, naming the V1 variable it found, or the reader is left guessing.
      assert.match(error.message, new RegExp(V1_ENDPOINT_VAR));
      assert.match(error.message, /different payload shapes/);
      return true;
    },
  );
});

test('e2e fails when neither variable exists', () => {
  const dir = fixtureDir({});

  assert.throws(
    () => withCleanEnv(() => resolveEndpoint('e2e', dir)),
    (error: Error) => {
      assert.match(error.message, new RegExp(V2_ENDPOINT_VAR));
      // No V1 value was found, so it must not claim one was.
      assert.doesNotMatch(error.message, /Found VITE_FORM_ENDPOINT instead/);
      return true;
    },
  );
});

test('e2e fails on an empty V2 value rather than treating it as configured', () => {
  const dir = fixtureDir({ '.env.e2e.local': `${V2_ENDPOINT_VAR}=\n` });
  assert.throws(() => withCleanEnv(() => resolveEndpoint('e2e', dir)));
});

/* ── Production reads only the V2 name ────────────────────────────────────── */

test('production uses the V2 endpoint from the build environment', () => {
  const dir = fixtureDir({});
  process.env[V2_ENDPOINT_VAR] = 'http://127.0.0.1:5399/exec';
  try {
    const resolved = resolveEndpoint('production', dir);
    assert.equal(resolved.endpoint, 'http://127.0.0.1:5399/exec');
    assert.equal(resolved.e2e, false);
  } finally {
    delete process.env[V2_ENDPOINT_VAR];
  }
});

test('production IGNORES the V1 variable entirely', () => {
  const dir = fixtureDir({ '.env': `${V1_ENDPOINT_VAR}=https://v1.example.test/exec\n` });

  const resolved = withCleanEnv(() => resolveEndpoint('production', dir));
  // No endpoint means the build fails closed. That is the correct outcome: it must never
  // quietly aim the V2 intake at the V1 deployment.
  assert.equal(resolved.endpoint, '');
  assert.equal(resolved.e2e, false);
});

test('production with no endpoint at all resolves to empty, never a default', () => {
  const dir = fixtureDir({});
  const resolved = withCleanEnv(() => resolveEndpoint('production', dir));
  assert.equal(resolved.endpoint, '');
});

/* ── The e2e warning must be accurate ─────────────────────────────────────── */

test('the e2e warning does not claim a submission creates a calendar event', () => {
  assert.match(E2E_WARNING, /REAL backend is ENABLED/);
  assert.match(E2E_WARNING, /live records/);
  // Booking is a separate command. Overstating the blast radius trains people to ignore it.
  assert.match(E2E_WARNING, /does NOT create a Calendar event/i);
});
