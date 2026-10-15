import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildInquiryMailto, parseAttribution, parseRole } from '../src/lib/contact.ts';
import { CREXI_BROKER_URL } from '../src/lib/site.ts';

const base = {
  role: 'tenant' as const,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '',
  place: 'Montrose, 2,000 sq ft',
  wantsManagement: true,
};

function decode(href: string) {
  const url = new URL(href);
  return {
    to: url.pathname,
    subject: url.searchParams.get('subject') ?? '',
    body: url.searchParams.get('body') ?? '',
  };
}

test('mailto goes to the firm inbox and carries every field', () => {
  const { to, subject, body } = decode(buildInquiryMailto(base, 'utm_source=flyer'));
  assert.equal(to, 'info@axispoint.llc');
  assert.match(subject, /tenant/);
  assert.match(body, /Name: Ada Lovelace/);
  assert.match(body, /Phone: not provided/);
  assert.match(body, /Area or space needed: Montrose, 2,000 sq ft/);
  assert.match(body, /property management: yes/);
  assert.match(body, /Source: leasing\.axispoint\.llc \(utm_source=flyer\)/);
});

test('landlord inquiries label the place as a property address', () => {
  const { body } = decode(buildInquiryMailto({ ...base, role: 'landlord' }));
  assert.match(body, /Property address:/);
});

test('special characters survive encoding', () => {
  const { body } = decode(buildInquiryMailto({ ...base, place: 'A&B #5 = "x"\nline2' }));
  assert.ok(body.includes('A&B #5 = "x"\nline2'));
});

test('role defaults to landlord and only accepts known values', () => {
  assert.equal(parseRole(null), 'landlord');
  assert.equal(parseRole('tenant'), 'tenant');
  assert.equal(parseRole('<script>'), 'landlord');
});

test('attribution keeps only allowed keys and caps length', () => {
  const out = parseAttribution('?utm_source=a&evil=b&src=' + 'x'.repeat(200));
  assert.ok(out.startsWith('utm_source=a, src='));
  assert.ok(!out.includes('evil'));
  assert.ok(out.length < 100);
});

test('CREXI_BROKER_URL uses https and is on crexi.com or a subdomain', () => {
  const url = new URL(CREXI_BROKER_URL);
  assert.equal(url.protocol, 'https:');
  assert.ok(
    url.hostname === 'crexi.com' || url.hostname.endsWith('.crexi.com'),
    `expected crexi.com host, got ${url.hostname}`,
  );
});
