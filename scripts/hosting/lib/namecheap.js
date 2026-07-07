// Shared Namecheap client for the XML API.
//
//   https://api.namecheap.com/xml.api
//
// Every request carries the five required auth/routing params: ApiUser, ApiKey,
// UserName, ClientIp, Command. Credentials come from the environment
// (see lib/env.js) — nothing is hardcoded.
//
// Namecheap responds with XML, e.g.:
//   <ApiResponse Status="OK" ...>
//     <Errors />
//     <CommandResponse Type="namecheap.domains.dns.getHosts">
//       <DomainDNSGetHostsResult Domain="axispoint.llc" ...>
//         <host HostId="12" Name="@" Type="A" Address="1.2.3.4" TTL="1800" .../>
//       </DomainDNSGetHostsResult>
//     </CommandResponse>
//   </ApiResponse>
//
// On failure Status="ERROR" and <Errors><Error Number="...">message</Error></Errors>.
//
// We ship a tiny purpose-built XML reader rather than a dependency: the two
// things we need are (a) the root Status + any Error text, and (b) the
// attributes of a repeated element (the <host> rows). Both are attribute-based,
// so a focused regex reader is sufficient and keeps the library dependency-free.

const { getEnv } = require('./env');

const ENDPOINT = 'https://api.namecheap.com/xml.api';

function assertFetch() {
  if (typeof fetch !== 'function') {
    throw new Error(
      'global fetch is not available. This library requires Node >= 18 (repo requires >= 20).'
    );
  }
}

// Decode the five XML entities Namecheap may emit in attribute values.
function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Pull the attributes off a single opening tag string like
// `<host Name="@" Type="A" Address="1.2.3.4" />`.
function parseAttributes(tagBody) {
  const attrs = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tagBody)) !== null) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  return attrs;
}

// Return an attribute object for every occurrence of `<tagName ...>` (case
// tolerant, self-closing or not). Used to read repeated <host> rows.
function findElements(xml, tagName) {
  const re = new RegExp(`<${tagName}\\b([^>]*?)\\/?>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(parseAttributes(m[1]));
  }
  return out;
}

// Read the value of a named attribute on the first matching opening tag.
function getRootAttribute(xml, tagName, attrName) {
  const m = new RegExp(`<${tagName}\\b([^>]*?)\\/?>`, 'i').exec(xml);
  if (!m) return undefined;
  return parseAttributes(m[1])[attrName];
}

// Extract the human-readable text of the first <Error ...>message</Error>.
function getErrorText(xml) {
  const m = /<Error\b[^>]*>([\s\S]*?)<\/Error>/i.exec(xml);
  return m ? decodeEntities(m[1].trim()) : '';
}

// Perform a Namecheap command and return the raw XML plus small helpers.
// Throws clearly on HTTP failure or Status != OK.
async function call(command, params = {}) {
  assertFetch();

  const url = new URL(ENDPOINT);
  url.searchParams.set('ApiUser', getEnv('NAMECHEAP_API_USER'));
  url.searchParams.set('ApiKey', getEnv('NAMECHEAP_API_KEY'));
  // UserName defaults to ApiUser unless explicitly overridden.
  url.searchParams.set(
    'UserName',
    getEnv('NAMECHEAP_USERNAME', { required: false }) || getEnv('NAMECHEAP_API_USER')
  );
  url.searchParams.set('ClientIp', getEnv('NAMECHEAP_CLIENT_IP'));
  url.searchParams.set('Command', command);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  let res;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (err) {
    throw new Error(`Namecheap request (${command}) failed: ${err.message}`);
  }

  const xml = await res.text();
  if (!res.ok) {
    throw new Error(`Namecheap ${command} returned HTTP ${res.status}: ${xml.slice(0, 500)}`);
  }

  const status = getRootAttribute(xml, 'ApiResponse', 'Status');
  if (status !== 'OK') {
    const detail = getErrorText(xml) || xml.slice(0, 400);
    throw new Error(`Namecheap ${command} status=${status || 'unknown'}: ${detail}`);
  }

  return { xml, findElements: (tag) => findElements(xml, tag), getRootAttribute, parseAttributes };
}

// Split a domain like "axispoint.llc" into { SLD: "axispoint", TLD: "llc" }
// as required by the domains.dns.* commands.
function splitDomain(domain) {
  const idx = domain.indexOf('.');
  if (idx === -1) {
    throw new Error(`Expected a domain with a TLD, got "${domain}"`);
  }
  return { SLD: domain.slice(0, idx), TLD: domain.slice(idx + 1) };
}

module.exports = { call, splitDomain, findElements, parseAttributes };
