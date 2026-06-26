/**
 * vCard utility — generates and triggers download of a .vcf file
 * containing both AxisPoint partners' contact cards.
 */

const VCARD = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Zachary Russell',
  'N:Russell;Zachary;;;',
  'ORG:AxisPoint Partners LLC',
  'TITLE:Partner',
  'EMAIL;TYPE=WORK:zach@axispoint.llc',
  'TEL;TYPE=WORK,VOICE:(832) 580-2815',
  'URL:https://axispoint.llc',
  'ADR;TYPE=WORK:;;Houston;TX;;;USA',
  'END:VCARD',
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Ethaniel Vu',
  'N:Vu;Ethaniel;;;',
  'ORG:AxisPoint Partners LLC',
  'TITLE:Partner',
  'EMAIL;TYPE=WORK:ethaniel@axispoint.llc',
  'TEL;TYPE=WORK,VOICE:(832) 499-8389',
  'URL:https://axispoint.llc',
  'ADR;TYPE=WORK:;;Houston;TX;;;USA',
  'END:VCARD',
].join('\r\n');

/**
 * Generate the combined partners vCard and trigger a browser download.
 */
export function downloadVCard(): void {
  const blob = new Blob([VCARD], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AxisPoint_Partners.vcf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
