// Shared cPanel client.
//
// Two call styles are exposed because cPanel splits functionality across two
// APIs and this project genuinely needs both:
//
//   uapi(module, func, params)  -> UAPI, the modern endpoint:
//                                  https://{HOST}:2083/execute/{module}/{func}
//   api2(module, func, params)  -> cPanel API 2, still the only way to do a few
//                                  older operations (notably Fileman::fileop
//                                  op=unlink for deleting files — there is no
//                                  UAPI equivalent):
//                                  https://{HOST}:2083/json-api/cpanel?...
//
// Both authenticate with a cPanel API token via the same header:
//   Authorization: cpanel {USERNAME}:{TOKEN}
//
// Credentials come from the environment (see lib/env.js). Nothing is hardcoded.

const { getEnv } = require('./env');

function creds() {
  return {
    host: getEnv('CPANEL_HOST'),
    username: getEnv('CPANEL_USERNAME'),
    token: getEnv('CPANEL_API_TOKEN'),
  };
}

function authHeader(username, token) {
  return `cpanel ${username}:${token}`;
}

// Node 18+ ships a global fetch; this project runs on Node >= 20.
function assertFetch() {
  if (typeof fetch !== 'function') {
    throw new Error(
      'global fetch is not available. This library requires Node >= 18 (repo requires >= 20).'
    );
  }
}

// UAPI: JSON in, JSON out. Success is `status === 1`; failures carry an
// `errors` array. We surface those verbatim so the caller sees cPanel's own
// message instead of a vague HTTP error.
async function uapi(module, func, params = {}) {
  assertFetch();
  const { host, username, token } = creds();

  const url = new URL(`https://${host}:2083/execute/${module}/${func}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader(username, token) },
    });
  } catch (err) {
    throw new Error(`cPanel UAPI request to ${host} failed: ${err.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `cPanel UAPI ${module}::${func} returned HTTP ${res.status}: ${text.slice(0, 500)}`
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `cPanel UAPI ${module}::${func} returned non-JSON (is CPANEL_HOST/port/token correct?): ${text.slice(0, 300)}`
    );
  }

  if (json.status !== 1) {
    const errors = Array.isArray(json.errors) ? json.errors.join('; ') : json.errors;
    throw new Error(`cPanel UAPI ${module}::${func} error: ${errors || 'unknown error'}`);
  }

  return json; // { status, errors, messages, data, metadata }
}

// cPanel API 2 via json-api. Response is wrapped in `cpanelresult`; success is
// `cpanelresult.event.result === 1`, and errors surface in `cpanelresult.error`
// or per-row `data[].result`.
async function api2(module, func, params = {}) {
  assertFetch();
  const { host, username, token } = creds();

  const url = new URL(`https://${host}:2083/json-api/cpanel`);
  url.searchParams.set('cpanel_jsonapi_user', username);
  url.searchParams.set('cpanel_jsonapi_apiversion', '2');
  url.searchParams.set('cpanel_jsonapi_module', module);
  url.searchParams.set('cpanel_jsonapi_func', func);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader(username, token) },
    });
  } catch (err) {
    throw new Error(`cPanel API2 request to ${host} failed: ${err.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `cPanel API2 ${module}::${func} returned HTTP ${res.status}: ${text.slice(0, 500)}`
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `cPanel API2 ${module}::${func} returned non-JSON (is CPANEL_HOST/port/token correct?): ${text.slice(0, 300)}`
    );
  }

  const result = json.cpanelresult;
  if (!result) {
    throw new Error(`cPanel API2 ${module}::${func}: unexpected response shape`);
  }
  if (result.error) {
    throw new Error(`cPanel API2 ${module}::${func} error: ${result.error}`);
  }
  if (result.event && result.event.result !== 1) {
    throw new Error(
      `cPanel API2 ${module}::${func} failed: ${result.event.reason || 'unknown error'}`
    );
  }

  return json; // { cpanelresult: { data, event, ... } }
}

module.exports = { uapi, api2 };
