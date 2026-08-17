#!/usr/bin/env node
// READ-ONLY. Lists the current Namecheap DNS records for a domain.
//
// Usage:
//   node hosting/list-dns.js            # defaults to axispoint.llc
//   node hosting/list-dns.js example.com

const { call, splitDomain } = require('./lib/namecheap');
const { printTable } = require('./lib/table');

async function main() {
  const domain = process.argv[2] || 'axispoint.llc';
  const { SLD, TLD } = splitDomain(domain);

  const res = await call('namecheap.domains.dns.getHosts', { SLD, TLD });
  const hosts = res.findElements('host');

  console.log(`DNS records for ${domain} (${hosts.length} record(s)):\n`);
  printTable(
    hosts.map((h) => ({
      type: h.Type,
      host: h.Name,
      value: h.Address,
      ttl: h.TTL,
      mxpref: h.Type === 'MX' ? h.MXPref : '',
    })),
    [
      { key: 'type', label: 'TYPE' },
      { key: 'host', label: 'HOST' },
      { key: 'value', label: 'VALUE' },
      { key: 'ttl', label: 'TTL' },
      { key: 'mxpref', label: 'MXPREF' },
    ]
  );
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
