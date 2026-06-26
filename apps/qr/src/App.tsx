import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { team } from '@brand/team';
import { ContactForm, downloadVCard } from '@axispoint/brand';
import Logo from './Logo';

const QR_URL = 'https://qr.axispoint.llc';

/* ── Per-partner vCard helpers (for the individual person-card buttons) ── */
const NOTE = (partner: string, phone: string) =>
  `AxisPoint Partners is a Houston-based commercial real estate firm offering asset management\\, property management\\, and investment advisory services. We specialize in multifamily and commercial acquisitions across the Sun Belt\\, delivering institutional-quality deal flow through a boutique\\, relationship-first approach.\\nWebsite: axispoint.llc\\nPartner: ${partner} - ${phone}`;

function makeVCard(
  firstName: string, lastName: string, title: string,
  phone: string, email: string, partnerName: string, partnerPhone: string
): string {
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${firstName} ${lastName}`,
    'ORG:AxisPoint Partners LLC',
    `TITLE:${title}`,
    `TEL;TYPE=CELL,VOICE:+1${phone.replace(/\D/g,'').slice(-10)}`,
    `EMAIL;TYPE=WORK,INTERNET:${email}`,
    'URL:https://axispoint.llc',
    'ADR;TYPE=WORK:;;Houston;;TX;;USA',
    `NOTE:${NOTE(partnerName, partnerPhone)}`,
    'END:VCARD',
  ].join('\r\n');
}

function downloadVCF(content: string, filename: string) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: 'text/vcard' })),
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ══════════════════════════════════════════════════════ */
export default function App() {
  const { zach, ethaniel } = team;

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  /* QR code */
  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, QR_URL, {
        width: 148,
        color: { dark: '#1C1628', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
    }
  }, []);

  /* ── Per-partner vCard downloads ── */
  function saveZach() {
    downloadVCF(makeVCard('Zachary','Russell','Partner, Multifamily Specialist',
      zach.phone, zach.email, 'Ethaniel Vu', ethaniel.phone), 'Zachary_Russell_AxisPoint.vcf');
  }
  function saveEthaniel() {
    downloadVCF(makeVCard('Ethaniel','Vu','Partner, Commercial Specialist',
      ethaniel.phone, ethaniel.email, 'Zachary Russell', zach.phone), 'Ethaniel_Vu_AxisPoint.vcf');
  }

  /* Smoothly scroll to the form */
  function scrollToForm() {
    document.getElementById('get-in-touch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main
      className="mx-auto px-5 py-9 flex flex-col items-center gap-[18px]"
      style={{ maxWidth: 430, paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
    >
      {/* ── Mobile optimizations ──
          16px inputs prevent iOS auto-zoom on focus; remove tap highlight. */}
      <style>{`
        input, textarea, select { font-size: 16px !important; }
        button, a { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* ── Logo header ── */}
      <header className="w-full text-center bg-white border border-border rounded-[20px] py-7 px-5 shadow-card">
        <Logo height={62} style={{ margin: '0 auto 14px' }} />
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg,transparent,#C4B8DC)' }} />
          <div className="w-1 h-1 rounded-full bg-[#9f328c]" />
          <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg,#B8E6EF,transparent)' }} />
        </div>
        <p className="font-serif italic text-sub" style={{ fontSize: '0.95rem' }}>Commercial real estate, done right.</p>
      </header>

      {/* ── Person cards (stacked vertically) ── */}
      <div className="flex flex-col gap-3.5 w-full">
        {[
          { member: zach,     accent: '#24A5BC', accentL: '#E8F7FA', accentM: '#B8E6EF', gradFrom: '#24A5BC', gradTo: '#1A8799', onSave: saveZach },
          { member: ethaniel, accent: '#38285D', accentL: '#EEEAF5', accentM: '#C4B8DC', gradFrom: '#38285D', gradTo: '#2A1E47', onSave: saveEthaniel },
        ].map(({ member, accent, accentL, accentM, gradFrom, gradTo, onSave }) => (
          <div key={member.id} className="bg-white border border-border rounded-[18px] overflow-hidden relative shadow-card transition-[transform,box-shadow] duration-200 active:scale-[0.99]">
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg,${gradFrom},${gradTo})` }} />
            <div className="p-[22px_20px_18px]">
              <div className="w-11 h-11 rounded-[11px] flex items-center justify-center font-serif font-semibold mb-2.5" style={{ background: accentL, color: accent, border: `1px solid ${accentM}`, fontSize: '1.1rem' }}>
                {member.initials}
              </div>
              <div className="font-serif font-semibold text-ink leading-tight mb-0.5" style={{ fontSize: '1.22rem' }}>{member.fullName}</div>
              <div className="font-semibold uppercase tracking-[0.11em] mb-3" style={{ fontSize: '0.63rem', color: accent }}>{member.title}</div>
              <div className="h-px bg-border mb-2.5" />
              <div className="flex flex-col gap-1.5 mb-3.5">
                <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 text-sub no-underline transition-all active:opacity-70" style={{ fontSize: '0.82rem', minHeight: 28 }}>
                  <svg className="flex-shrink-0 opacity-45" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span className="truncate">{member.email}</span>
                </a>
                <a href={`tel:+1${member.phone.replace(/\D/g,'')}`} className="flex items-center gap-1.5 text-sub no-underline transition-all active:opacity-70" style={{ fontSize: '0.82rem', minHeight: 28 }}>
                  <svg className="flex-shrink-0 opacity-45" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.18 1.5h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.56-1.56a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {member.phone}
                </a>
              </div>
              <button type="button" onClick={onSave}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-[9px] border-none text-white text-[0.82rem] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
                style={{ background: accent }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save Contact
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Save Our Contacts (shared vCard, prominent full width) ── */}
      <button type="button" onClick={downloadVCard}
        className="w-full min-h-[44px] py-3.5 px-5 rounded-[12px] border-none text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.97] shadow-[0_2px_12px_rgba(36,165,188,.2)]"
        style={{ background: '#24A5BC', fontSize: '0.9rem' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save Our Contacts
      </button>

      {/* ── Get in touch (shared form) ── */}
      <div id="get-in-touch" className="w-full bg-white border border-border rounded-[20px] overflow-hidden shadow-card relative">
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg,#38285D,#9F328C)' }} />
        <div className="p-5">
          <div className="text-center mb-5">
            <div className="flex justify-center gap-1.5 mb-2.5">
              <div className="w-[7px] h-[7px] rounded-full bg-purple" />
              <div className="w-[7px] h-[7px] rounded-full bg-[#9F328C]" />
            </div>
            <div className="font-serif font-semibold text-ink mb-1" style={{ fontSize: '1.3rem' }}>Get in touch</div>
            <p className="text-[0.8rem] text-sub leading-snug max-w-[360px] mx-auto">Tell us a bit about yourself and we will follow up personally.</p>
          </div>

          <ContactForm source="qr" page="qr.axispoint.llc" className="w-full" />
        </div>
      </div>

      {/* ── QR code section ── */}
      <div className="w-full bg-white border border-border rounded-[20px] overflow-hidden shadow-card text-center">
        <div className="h-[3px]" style={{background:'linear-gradient(90deg,#24A5BC,#38285D)'}}/>
        <div className="p-5">
          <div className="flex justify-center gap-1.5 mb-2.5">
            <div className="w-[7px] h-[7px] rounded-full bg-teal"/>
            <div className="w-[7px] h-[7px] rounded-full bg-purple"/>
          </div>
          <div className="font-serif font-semibold text-ink mb-1" style={{fontSize:'1.3rem'}}>Share this page</div>
          <p className="text-[0.8rem] text-sub leading-snug max-w-[360px] mx-auto mb-5">Scan or screenshot and pass our digital card to someone.</p>
          <div className="flex flex-col items-center gap-3">
            <div className="relative bg-white rounded-[13px] p-3 border border-border shadow-[0_2px_10px_rgba(56,40,93,.07)]">
              <div className="absolute top-[-2px] left-[-2px] w-[15px] h-[15px] border-t-[2.5px] border-l-[2.5px] rounded-tl-[3px]" style={{borderColor:'#24a5bc'}}/>
              <div className="absolute top-[-2px] right-[-2px] w-[15px] h-[15px] border-t-[2.5px] border-r-[2.5px] rounded-tr-[3px]" style={{borderColor:'#24a5bc'}}/>
              <div className="absolute bottom-[-2px] left-[-2px] w-[15px] h-[15px] border-b-[2.5px] border-l-[2.5px] rounded-bl-[3px]" style={{borderColor:'#24a5bc'}}/>
              <div className="absolute bottom-[-2px] right-[-2px] w-[15px] h-[15px] border-b-[2.5px] border-r-[2.5px] rounded-br-[3px]" style={{borderColor:'#24a5bc'}}/>
              <canvas ref={qrCanvasRef} style={{display:'block'}}/>
            </div>
            <div className="text-[0.76rem] text-sub tracking-[0.06em] font-medium">qr.axispoint.llc</div>
            <button type="button" onClick={scrollToForm}
              className="text-[0.72rem] text-teal font-semibold underline-offset-2 hover:underline active:opacity-70"
            >
              Let's talk — jump to the form
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <a href="https://axispoint.llc" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-full border no-underline text-sub text-[0.82rem] font-medium transition-all active:border-purple active:text-purple active:bg-[#EEEAF5]"
        style={{borderColor:'#D4CEE8', background:'#fff'}}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Visit axispoint.llc
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
      <p className="text-[0.66rem] text-hint text-center">2025 AxisPoint Partners LLC, Houston, Texas</p>

    </main>
  );
}
