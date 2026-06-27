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

/**
 * Share the combined partners vCard as a native .vcf file using the Web Share
 * API. Falls back to {@link downloadVCard} when file sharing is unsupported.
 */
export async function shareVCard(): Promise<void> {
  const blob = new Blob([VCARD], { type: 'text/vcard' });
  const file = new File([blob], 'AxisPoint-Partners.vcf', { type: 'text/vcard' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'AxisPoint Partners',
        text: 'Zachary Russell and Ethaniel Vu — AxisPoint Partners',
        files: [file],
      });
    } catch {
      /* user cancelled or share failed — no-op */
    }
  } else {
    downloadVCard();
  }
}
