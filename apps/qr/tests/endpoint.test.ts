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
 * Endpoint selection for apps/qr.
 *
 * THE POINT OF THESE TESTS. This app read `VITE_FORM_ENDPOINT` until Code Pass 10B. That
 * name still refers to the V1 Apps Script deployment, which speaks a completely different
 * payload shape from the V2 `contact_exchange` envelope the Contact Exchange now sends. If
 * the app inherited the old name, every exchange would be posted to the wrong backend and
 * rejected there, and the symptom would read as a backend bug rather than a configuration
 * mistake. So the V2 name is required and a lone V1 value is an error, not a fallback.
 *
 * Every case runs against a TEMPORARY FIXTURE DIRECTORY. The real machine-local
 * `.env.e2e.local` is never read, listed, or executed against.
 */

function fixtureDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axp-qr-env-'));
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

test('development forces the endpoint empty, so plain dev always simulates', () => {
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
      // It must name the V1 variable it found, or the reader is left guessing.
      assert.match(error.message, new RegExp(V1_ENDPOINT_VAR));
      assert.match(error.message, /contact_exchange/);
      return true;
    },
  );
});

test('e2e fails when neither variable exists, and does not claim it found V1', () => {
  const dir = fixtureDir({});

  assert.throws(
    () => withCleanEnv(() => resolveEndpoint('e2e', dir)),
    (error: Error) => {
      assert.match(error.message, new RegExp(V2_ENDPOINT_VAR));
      assert.doesNotMatch(error.message, /Found VITE_FORM_ENDPOINT instead/);
      return true;
    },
  );
});

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

test('production IGNORES the V1 variable entirely and fails closed', () => {
  const dir = fixtureDir({ '.env': `${V1_ENDPOINT_VAR}=https://v1.example.test/exec\n` });

  const resolved = withCleanEnv(() => resolveEndpoint('production', dir));
  // Empty means the build fails closed, which is correct: it must never quietly aim a V2
  // contact_exchange at the V1 deployment.
  assert.equal(resolved.endpoint, '');
});

test('the e2e warning does not claim a submission creates a calendar event', () => {
  assert.match(E2E_WARNING, /REAL backend is ENABLED/);
  assert.doesNotMatch(E2E_WARNING, /creates a live lead, email, and calendar event/);
  assert.match(E2E_WARNING, /does NOT create a Calendar event/i);
});
