import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { team } from '@brand/team';
import Logo from './Logo';

/* ── Types ── */
type Role = 'investor' | 'referral' | 'pro' | 'curious' | 'refer';
type FormStep = 'role' | 'context' | 'prefs' | 'contact' | 'comms' | 'booking' | 'success';
type MeetType = 'meet' | 'phone' | null;

const STEP_ORDER_INVESTOR: FormStep[] = ['role', 'context', 'prefs', 'contact', 'booking', 'comms'];
const STEP_ORDER_OTHER: FormStep[]    = ['role', 'context',          'contact', 'booking', 'comms'];
const STEP_LABELS_INVESTOR = ['Who you are', 'Background', 'Preferences', 'Your info', 'Book', 'Updates'];
const STEP_LABELS_OTHER    = ['Who you are', 'Background', 'Your info', 'Book', 'Updates'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const SLOTS  = ['8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
                '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'];
const TAKEN  = new Set(['9:00 AM','11:00 AM','2:00 PM','3:30 PM']);

const QR_URL = 'https://qr.axispoint.llc';
const FORM_ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT as string | undefined;

function buildCalendar(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

/* ── vCard helpers ── */
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

/* ── Chip components ── */
function ChipS({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
        sel ? 'border-purple bg-[#EEEAF5] text-purple' : 'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >{label}</button>
  );
}

function ChipM({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
        sel ? 'border-teal bg-[#E8F7FA] text-teal' : 'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >{label}</button>
  );
}

function CapC({ label, sel, dim, onClick }: { label: string; sel: boolean; dim?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`py-2.5 px-1 rounded-[9px] border text-xs font-semibold transition-all cursor-pointer text-center leading-snug ${
        sel ? 'border-[#9F328C] bg-[#F5EAF4] text-[#9F328C]' :
        dim  ? 'border-border bg-white text-sub/40 hover:text-sub hover:border-[#D4CEE8]' :
               'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >{label}</button>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.63rem] font-semibold text-sub uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1">{children}</div>;
}
function FLNote({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.6rem] font-normal normal-case tracking-normal text-hint">{children}</span>;
}

function FG({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5">{children}</div>;
}

function FInput({ id, label, type = 'text', placeholder, autocomplete }: {
  id: string; label: React.ReactNode; type?: string; placeholder: string; autocomplete?: string;
}) {
  return (
    <FG>
      <FL>{label}</FL>
      <input id={id} type={type} placeholder={placeholder} autoComplete={autocomplete}
        className="w-full bg-white border border-border rounded-[9px] px-3 py-2.5 text-ink text-sm outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5]"
      />
    </FG>
  );
}

function FTextarea({ id, label, placeholder, rows = 3 }: { id: string; label: string; placeholder: string; rows?: number }) {
  return (
    <FG>
      <FL>{label}</FL>
      <textarea id={id} placeholder={placeholder} rows={rows}
        className="w-full bg-white border border-border rounded-[9px] px-3 py-2.5 text-ink text-sm outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5] resize-y leading-snug min-h-[74px]"
      />
    </FG>
  );
}

function SQ({ children }: { children: React.ReactNode }) {
  return <div className="font-serif font-semibold text-ink mb-1 leading-snug" style={{ fontSize: '1.15rem' }}>{children}</div>;
}
function SHint({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.78rem] text-sub leading-relaxed mb-4">{children}</div>;
}

/* ── Progress ── */
function Progress({ stepOrder, currentStep }: { stepOrder: FormStep[]; currentStep: FormStep }) {
  const labels = stepOrder.length === 6 ? STEP_LABELS_INVESTOR : STEP_LABELS_OTHER;
  const cur = stepOrder.indexOf(currentStep);
  return (
    <div className="mb-5">
      <div className="flex items-center">
        {stepOrder.map((s, i) => (
          <>
            <div key={`d-${s}`}
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[0.66rem] font-semibold flex-shrink-0 z-10 transition-all ${
                i < cur  ? 'border-teal bg-teal text-white' :
                i === cur ? 'border-purple bg-[#EEEAF5] text-purple' :
                            'border-[#D4CEE8] bg-white text-hint'
              }`}
            >
              {i < cur ? '✓' : i + 1}
            </div>
            {i < stepOrder.length - 1 && (
              <div key={`l-${i}`} className="flex-1 h-[1.5px] transition-all"
                style={{ background: i < cur ? 'linear-gradient(90deg,#24a5bc,#38285d)' : '#E8E4F0' }}
              />
            )}
          </>
        ))}
      </div>
      <div className="flex mt-1.5">
        {labels.map((lbl, i) => (
          <span key={lbl}
            className={`flex-1 text-[0.58rem] font-medium transition-colors ${
              i === cur ? 'text-purple' : i < cur ? 'text-teal' : 'text-hint'
            } ${i === 0 ? 'text-left' : i === labels.length - 1 ? 'text-right' : 'text-center'}`}
          >{lbl}</span>
        ))}
      </div>
    </div>
  );
}

function NavBack({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2.5 rounded-[9px] border border-border bg-transparent text-sub text-[0.82rem] font-medium cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink flex-shrink-0"
    >Back</button>
  );
}

function NavNext({ onClick, disabled, label = 'Continue' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex-1 py-3 px-4 rounded-[9px] border-none bg-purple text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════ */
export default function App() {
  const { zach, ethaniel } = team;

  /* form state */
  const [step, setStep]         = useState<FormStep>('role');
  const [role, setRole]         = useState<Role | null>(null);
  const [bookChoice, setBookChoice] = useState<'yes' | 'no' | null>(null);
  const [meetType, setMeetType]     = useState<MeetType>(null);
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);
  const [selSlot, setSelSlot]   = useState<string | null>(null);

  /* multi-select */
  const [aumSel, setAumSel]           = useState<string | null>(null);
  const [expSel, setExpSel]           = useState<Set<string>>(new Set());
  const [profSel, setProfSel]         = useState<string | null>(null);
  const [clientsSel, setClientsSel]   = useState<Set<string>>(new Set());
  const [refIntentSel, setRefIntentSel] = useState<string | null>(null);
  const [proRoleSel, setProRoleSel]   = useState<string | null>(null);
  const [marketSel, setMarketSel]     = useState<Set<string>>(new Set());
  const [proIntentSel, setProIntentSel] = useState<string | null>(null);
  const [curiousSel, setCuriousSel]   = useState<Set<string>>(new Set());
  const [journeySel, setJourneySel]   = useState<string | null>(null);
  const [relSel, setRelSel]           = useState<string | null>(null);
  const [fitSel, setFitSel]           = useState<Set<string>>(new Set());
  const [awareSel, setAwareSel]       = useState<string | null>(null);
  const [assetSel, setAssetSel]       = useState<Set<string>>(new Set());
  const [capSel, setCapSel]           = useState<string | null>(null);
  const [timelineSel, setTimelineSel] = useState<string | null>(null);
  const [sourceSel, setSourceSel]     = useState<string | null>(null);
  const [prefsSel, setPrefsSel]       = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);

  const stepOrder = role === 'investor' ? STEP_ORDER_INVESTOR : STEP_ORDER_OTHER;

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, QR_URL, {
        width: 148,
        color: { dark: '#1C1628', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
    }
  }, []);

  useEffect(() => {
    setSelDay(null); setSelSlot(null);
  }, [calMonth, calYear]);

  useEffect(() => {
    if (selDay !== null) setSelSlot(null);
  }, [selDay]);

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setFn(next);
  }

  function goNext() {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
    else setStep('success');
  }
  function goBack() {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  }
  function s2Next() {
    if (role === 'investor') setStep('prefs'); else setStep('contact');
  }

  async function submitForm() {
    setSubmitting(true);
    const booking = bookChoice === 'yes' && selDay !== null && selSlot ? {
      date: `${MONTHS[calMonth]} ${selDay}, ${calYear}`,
      slot: selSlot,
      meetType,
      phone: (document.getElementById('cal-phone') as HTMLInputElement | null)?.value.trim() ?? '',
    } : null;
    const payload = {
      role,
      qualData: {
        experience: [...expSel],
        aum: aumSel,
        profession: profSel,
        clients: [...clientsSel],
        referralIntent: refIntentSel,
        proRole: proRoleSel,
        markets: [...marketSel],
        proIntent: proIntentSel,
        curious: [...curiousSel],
        journey: journeySel,
        relationship: relSel,
        fit: [...fitSel],
        assetClasses: [...assetSel],
        checkSize: capSel,
        timeline: timelineSel,
        awareness: awareSel,
      },
      person: {
        firstName: (document.getElementById('c-fn') as HTMLInputElement | null)?.value.trim() ?? '',
        lastName:  (document.getElementById('c-ln') as HTMLInputElement | null)?.value.trim() ?? '',
        email:     (document.getElementById('c-em') as HTMLInputElement | null)?.value.trim() ?? '',
        phone:     (document.getElementById('c-ph') as HTMLInputElement | null)?.value.trim() ?? '',
        company:   (document.getElementById('c-co') as HTMLInputElement | null)?.value.trim() ?? '',
      },
      preferences: [...prefsSel],
      booking,
      message: (document.getElementById('c-msg') as HTMLTextAreaElement | null)?.value.trim() ?? '',
      source: sourceSel ?? '',
      timestamp: new Date().toISOString(),
      page: 'qr.axispoint.llc',
    };
    try {
      if (FORM_ENDPOINT) {
        await fetch(FORM_ENDPOINT, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    } catch {
      // fail silently
    } finally {
      setSubmitting(false);
      setStep('success');
    }
  }

  const today = new Date();
  const calCells = buildCalendar(calYear, calMonth);
  const isPast = (d: number) => new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isWknd = (_d: number, idx: number) => { const c = idx % 7; return c === 0 || c === 6; };
  const canPrevMonth = !(calYear === today.getFullYear() && calMonth === today.getMonth());
  function changeMonth(dir: -1 | 1) {
    let m = calMonth + dir, y = calYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setCalMonth(m); setCalYear(y);
  }

  /* ── vCard downloads ── */
  function saveZach() {
    downloadVCF(makeVCard('Zachary','Russell','Partner, Multifamily Specialist',
      zach.phone, zach.email, 'Ethaniel Vu', ethaniel.phone), 'Zachary_Russell_AxisPoint.vcf');
  }
  function saveEthaniel() {
    downloadVCF(makeVCard('Ethaniel','Vu','Partner, Commercial Specialist',
      ethaniel.phone, ethaniel.email, 'Zachary Russell', zach.phone), 'Ethaniel_Vu_AxisPoint.vcf');
  }
  function saveBoth() {
    const combined = [
      makeVCard('Zachary','Russell','Partner, Multifamily Specialist',
        zach.phone, zach.email, 'Ethaniel Vu', ethaniel.phone),
      makeVCard('Ethaniel','Vu','Partner, Commercial Specialist',
        ethaniel.phone, ethaniel.email, 'Zachary Russell', zach.phone),
    ].join('\r\n');
    downloadVCF(combined, 'AxisPoint_Partners.vcf');
  }

  /* ── Pref toggle ── */
  function PrefItem({ val, title, desc }: { val: string; title: string; desc: string }) {
    const on = prefsSel.has(val);
    return (
      <div onClick={() => toggleSet(prefsSel, setPrefsSel, val)}
        className={`flex items-start gap-3 px-4 py-3.5 border rounded-xl cursor-pointer transition-all ${
          on ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
        }`}
      >
        <div className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
          on ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] bg-white'
        }`}>
          {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <div>
          <div className="text-[0.875rem] font-semibold text-ink mb-0.5">{title}</div>
          <div className="text-[0.76rem] text-sub leading-snug">{desc}</div>
        </div>
      </div>
    );
  }

  const isSuccess = step === 'success';

  return (
    <main className="max-w-[680px] mx-auto px-4 py-9 pb-20 flex flex-col items-center gap-[18px]">

      {/* ── Logo header ── */}
      <header className="w-full text-center bg-white border border-border rounded-[20px] py-7 px-6 shadow-card">
        <Logo height={62} style={{ margin: '0 auto 14px' }} />
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg,transparent,#C4B8DC)' }} />
          <div className="w-1 h-1 rounded-full bg-[#9f328c]" />
          <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg,#B8E6EF,transparent)' }} />
        </div>
        <p className="font-serif italic text-sub" style={{ fontSize: '0.95rem' }}>Commercial real estate, done right.</p>
      </header>

      {/* ── Person cards ── */}
      <div className="grid grid-cols-2 gap-3.5 w-full">
        {[
          { member: zach,     accent: '#24A5BC', accentL: '#E8F7FA', accentM: '#B8E6EF', gradFrom: '#24A5BC', gradTo: '#1A8799', onSave: saveZach },
          { member: ethaniel, accent: '#38285D', accentL: '#EEEAF5', accentM: '#C4B8DC', gradFrom: '#38285D', gradTo: '#2A1E47', onSave: saveEthaniel },
        ].map(({ member, accent, accentL, accentM, gradFrom, gradTo, onSave }) => (
          <div key={member.id} className="bg-white border border-border rounded-[18px] overflow-hidden relative shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(56,40,93,.08),0_18px_40px_rgba(56,40,93,.13)]">
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg,${gradFrom},${gradTo})` }} />
            <div className="p-[22px_18px_18px]">
              <div className="w-11 h-11 rounded-[11px] flex items-center justify-center font-serif font-semibold mb-2.5" style={{ background: accentL, color: accent, border: `1px solid ${accentM}`, fontSize: '1.1rem' }}>
                {member.initials}
              </div>
              <div className="font-serif font-semibold text-ink leading-tight mb-0.5" style={{ fontSize: '1.22rem' }}>{member.fullName}</div>
              <div className="font-semibold uppercase tracking-[0.11em] mb-3" style={{ fontSize: '0.63rem', color: accent }}>{member.title}</div>
              <div className="h-px bg-border mb-2.5" />
              <div className="flex flex-col gap-1.5 mb-3.5">
                <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 text-sub no-underline transition-all hover:text-ink hover:translate-x-0.5" style={{ fontSize: '0.76rem' }}>
                  <svg className="flex-shrink-0 opacity-45" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span className="truncate">{member.email}</span>
                </a>
                <a href={`tel:+1${member.phone.replace(/\D/g,'')}`} className="flex items-center gap-1.5 text-sub no-underline transition-all hover:text-ink hover:translate-x-0.5" style={{ fontSize: '0.76rem' }}>
                  <svg className="flex-shrink-0 opacity-45" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.18 1.5h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.56-1.56a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {member.phone}
                </a>
              </div>
              <button type="button" onClick={onSave}
                className="w-full py-2.5 px-3 rounded-[9px] border-none text-white text-[0.76rem] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:brightness-[1.07] active:scale-[0.97]"
                style={{ background: accent }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save Contact
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Save both ── */}
      <button type="button" onClick={saveBoth}
        className="w-full py-3.5 px-5 rounded-[12px] border-none bg-purple text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all hover:brightness-110 active:scale-[0.97] shadow-[0_2px_12px_rgba(56,40,93,.15)]"
        style={{ fontSize: '0.875rem' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save Both Contacts
      </button>

      {/* ── Qualification form ── */}
      <div className="w-full bg-white border border-border rounded-[20px] overflow-hidden shadow-card relative">
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg,#38285D,#9F328C)' }} />
        <div className="p-[26px_22px]">
          <div className="text-center mb-5">
            <div className="flex justify-center gap-1.5 mb-2.5">
              <div className="w-[7px] h-[7px] rounded-full bg-purple" />
              <div className="w-[7px] h-[7px] rounded-full bg-[#9F328C]" />
            </div>
            <div className="font-serif font-semibold text-ink mb-1" style={{ fontSize: '1.3rem' }}>Get in touch</div>
            <p className="text-[0.8rem] text-sub leading-snug max-w-[360px] mx-auto">Tell us a bit about yourself and we will follow up personally.</p>
          </div>

          {!isSuccess && <Progress stepOrder={stepOrder} currentStep={step} />}

          {/* ── Step 1: Role ── */}
          {step === 'role' && (
            <div>
              <SQ>Who are you?</SQ>
              <SHint>Pick the option that fits best. The form adapts from here.</SHint>
              <div className="grid grid-cols-2 gap-[9px]">
                {[
                  { r: 'investor' as Role, label: 'Investor', desc: 'Looking to place capital in CRE',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, bg: '#E8F7FA', c: '#24A5BC' },
                  { r: 'referral' as Role, label: 'Referral Partner', desc: 'CPA, attorney, or advisor',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>, bg: '#EEEAF5', c: '#38285D' },
                  { r: 'pro' as Role, label: 'RE Professional', desc: 'Broker, lender, or developer',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>, bg: '#F5EAF4', c: '#9F328C' },
                  { r: 'curious' as Role, label: 'Exploring CRE', desc: 'Learning, just starting out',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, bg: '#E8F7FA', c: '#24A5BC' },
                ].map(({ r, label, desc, icon, bg, c }) => {
                  const sel = role === r;
                  return (
                    <div key={r} onClick={() => setRole(r)}
                      className={`rounded-[12px] border cursor-pointer transition-all p-[15px_13px_13px] relative ${
                        sel ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:-translate-y-0.5 hover:bg-white'
                      }`}
                    >
                      <div className={`absolute top-2 right-2 w-[15px] h-[15px] rounded-full border flex items-center justify-center text-[0.52rem] transition-all ${
                        sel ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
                      }`}>✓</div>
                      <div className="w-9 h-9 rounded-[9px] flex items-center justify-center mb-2" style={{ background: bg, color: c }}>{icon}</div>
                      <div className="text-[0.82rem] font-semibold text-ink mb-0.5">{label}</div>
                      <div className="text-[0.68rem] text-sub leading-snug">{desc}</div>
                    </div>
                  );
                })}
                {/* Wide refer tile */}
                {(() => {
                  const sel = role === 'refer';
                  return (
                    <div onClick={() => setRole('refer')}
                      className={`col-span-2 rounded-[12px] border cursor-pointer transition-all flex items-center gap-2.5 p-[13px_15px] ${
                        sel ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-[15px] h-[15px] rounded-full border flex items-center justify-center text-[0.52rem] transition-all ${
                        sel ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
                      }`}>✓</div>
                      <div className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: '#EEEAF5', color: '#38285D' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      </div>
                      <div>
                        <div className="text-[0.82rem] font-semibold text-ink mb-0.5">Referring Someone</div>
                        <div className="text-[0.68rem] text-sub leading-snug">I know someone who might be a fit</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2 mt-5">
                <NavNext onClick={() => setStep('context')} disabled={!role} />
              </div>
            </div>
          )}

          {/* ── Step 2: Context ── */}
          {step === 'context' && (
            <div>
              {role === 'investor' && (
                <>
                  <SQ>Your investor background</SQ>
                  <SHint>This helps us match you with the right opportunities.</SHint>
                  <FG>
                    <FL>Investable liquid capital <FLNote>(available for alternatives)</FLNote></FL>
                    <div className="grid grid-cols-3 gap-[7px]">
                      {['Under $500K','$500K to $1M','$1M to $3M','$3M to $10M','$10M or more','Prefer not to say'].map((v,i) => (
                        <CapC key={v} label={v} sel={aumSel===v} dim={i<2} onClick={() => setAumSel(aumSel===v?null:v)} />
                      ))}
                    </div>
                    <p className="text-[0.66rem] text-hint mt-1.5 leading-relaxed">Our typical minimum check is $1M per deal. Lower tiers shown so we can stay connected.</p>
                  </FG>
                  <FG>
                    <FL>Prior CRE involvement <FLNote>(select all)</FLNote></FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['No CRE experience yet','Residential properties','Passive LP in a syndication','Direct commercial ownership','1031 exchange experience','Institutional background'].map(v => (
                        <ChipM key={v} label={v} sel={expSel.has(v)} onClick={() => toggleSet(expSel, setExpSel, v)} />
                      ))}
                    </div>
                  </FG>
                </>
              )}
              {role === 'referral' && (
                <>
                  <SQ>About your practice</SQ>
                  <SHint>We work closely with professionals who serve high-net-worth clients.</SHint>
                  <FG><FL>Your profession</FL><div className="flex flex-wrap gap-1.5">{['CPA / Tax Advisor','Attorney','Financial Advisor / RIA','Wealth Manager','Insurance / Estate Planning','Other'].map(v=><ChipS key={v} label={v} sel={profSel===v} onClick={()=>setProfSel(profSel===v?null:v)}/>)}</div></FG>
                  <FG><FL>Client base <FLNote>(select all)</FLNote></FL><div className="flex flex-wrap gap-1.5">{['High-net-worth individuals','Business owners','Real estate investors','General affluent clients'].map(v=><ChipM key={v} label={v} sel={clientsSel.has(v)} onClick={()=>toggleSet(clientsSel,setClientsSel,v)}/>)}</div></FG>
                  <FG><FL>What brings you here?</FL><div className="flex flex-wrap gap-1.5">{['I actively refer CRE opportunities','I have a specific client in mind','Building a referral relationship','Exploring if there is a fit'].map(v=><ChipS key={v} label={v} sel={refIntentSel===v} onClick={()=>setRefIntentSel(refIntentSel===v?null:v)}/>)}</div></FG>
                </>
              )}
              {role === 'pro' && (
                <>
                  <SQ>Your CRE work</SQ>
                  <SHint>Tell us what you do. We are always open to the right collaborations.</SHint>
                  <FG><FL>Primary role</FL><div className="flex flex-wrap gap-1.5">{['Investment Sales / Brokerage','Property Management','Lending / Finance','Development / Construction','Real Estate Attorney','Title / Escrow','Other'].map(v=><ChipS key={v} label={v} sel={proRoleSel===v} onClick={()=>setProRoleSel(proRoleSel===v?null:v)}/>)}</div></FG>
                  <FG><FL>Primary market <FLNote>(select all)</FLNote></FL><div className="flex flex-wrap gap-1.5">{['Houston','DFW','Austin / San Antonio','Sun Belt','National'].map(v=><ChipM key={v} label={v} sel={marketSel.has(v)} onClick={()=>toggleSet(marketSel,setMarketSel,v)}/>)}</div></FG>
                  <FG><FL>How can we work together?</FL><div className="flex flex-wrap gap-1.5">{['Deal collaboration','JV or co-investment','Client referral','Networking'].map(v=><ChipS key={v} label={v} sel={proIntentSel===v} onClick={()=>setProIntentSel(proIntentSel===v?null:v)}/>)}</div></FG>
                </>
              )}
              {role === 'curious' && (
                <>
                  <SQ>What are you curious about?</SQ>
                  <SHint>Everyone starts somewhere. Tell us what you want to learn.</SHint>
                  <FG><FL>What interests you? <FLNote>(select all)</FLNote></FL><div className="flex flex-wrap gap-1.5">{['Passive income from real estate','How syndications work','1031 exchange strategies','Tax advantages of CRE','Building long-term wealth','Deal analysis basics'].map(v=><ChipM key={v} label={v} sel={curiousSel.has(v)} onClick={()=>toggleSet(curiousSel,setCuriousSel,v)}/>)}</div></FG>
                  <FG><FL>Where are you financially right now?</FL><div className="flex flex-wrap gap-1.5">{['Saving toward my first investment','I have capital but not sure where to start','In stocks, curious about CRE','I own residential real estate already'].map(v=><ChipS key={v} label={v} sel={journeySel===v} onClick={()=>setJourneySel(journeySel===v?null:v)}/>)}</div></FG>
                </>
              )}
              {role === 'refer' && (
                <>
                  <SQ>Tell us about the connection</SQ>
                  <SHint>This helps us make a warm, informed introduction.</SHint>
                  <FG><FL>Your relationship to them</FL><div className="flex flex-wrap gap-1.5">{['Family member','Friend','Business partner or colleague','Client','Met recently'].map(v=><ChipS key={v} label={v} sel={relSel===v} onClick={()=>setRelSel(relSel===v?null:v)}/>)}</div></FG>
                  <FG><FL>Why might they be a fit? <FLNote>(select all)</FLNote></FL><div className="flex flex-wrap gap-1.5">{['Has significant investable capital','Expressed interest in CRE','Looking for passive income','Wants to diversify from stocks','Has a 1031 exchange situation'].map(v=><ChipM key={v} label={v} sel={fitSel.has(v)} onClick={()=>toggleSet(fitSel,setFitSel,v)}/>)}</div></FG>
                  <FG><FL>Do they know you are reaching out?</FL><div className="flex flex-wrap gap-1.5">{['Yes, they are expecting a call','Not yet','I will handle the intro myself'].map(v=><ChipS key={v} label={v} sel={awareSel===v} onClick={()=>setAwareSel(awareSel===v?null:v)}/>)}</div></FG>
                </>
              )}
              <div className="flex gap-2 mt-5"><NavBack onClick={goBack}/><NavNext onClick={s2Next}/></div>
            </div>
          )}

          {/* ── Step 3: Investor prefs ── */}
          {step === 'prefs' && (
            <div>
              <SQ>What you are looking for</SQ>
              <SHint>Help us match you with the right deals and the right person at AxisPoint.</SHint>
              <FG>
                <FL>Asset class interest <FLNote>(select all)</FLNote></FL>
                <div className="flex flex-wrap gap-1.5">
                  {['Multifamily','Industrial','Office','Retail','Mixed-Use','Self-Storage','Help me decide'].map(v=>(
                    <ChipM key={v} label={v} sel={assetSel.has(v)} onClick={()=>toggleSet(assetSel,setAssetSel,v)}/>
                  ))}
                </div>
              </FG>
              <FG>
                <FL>Target check size per deal</FL>
                <div className="grid grid-cols-3 gap-[7px]">
                  {['Under $500K','$500K to $1M','$1M to $2.5M','$2.5M to $5M','$5M to $10M','$10M+ / Family Office'].map((v,i)=>(
                    <CapC key={v} label={v} sel={capSel===v} dim={i<2} onClick={()=>setCapSel(capSel===v?null:v)}/>
                  ))}
                </div>
              </FG>
              <FG>
                <FL>Investment timeline</FL>
                <div className="flex flex-wrap gap-1.5">
                  {['Ready to move now','Within 6 months','6 to 12 months','Just researching'].map(v=>(
                    <ChipS key={v} label={v} sel={timelineSel===v} onClick={()=>setTimelineSel(timelineSel===v?null:v)}/>
                  ))}
                </div>
              </FG>
              <div className="flex gap-2 mt-5"><NavBack onClick={goBack}/><NavNext onClick={goNext}/></div>
            </div>
          )}

          {/* ── Contact info ── */}
          {step === 'contact' && (
            <div>
              <SQ>How do we reach you?</SQ>
              <SHint>We will follow up personally.</SHint>
              <div className="grid grid-cols-2 gap-2.5">
                <FInput id="c-fn" label="First Name *" placeholder="Jane" autocomplete="given-name"/>
                <FInput id="c-ln" label="Last Name *" placeholder="Smith" autocomplete="family-name"/>
              </div>
              <FInput id="c-em" label="Email *" type="email" placeholder="jane@company.com" autocomplete="email"/>
              <FInput id="c-ph" label="Phone" type="tel" placeholder="(713) 555-0100" autocomplete="tel"/>
              <FInput id="c-co" label="Company / Firm" placeholder="Your company" autocomplete="organization"/>
              {role === 'refer' && (
                <>
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-border"/><span className="text-[0.62rem] font-semibold tracking-[0.09em] uppercase text-sub whitespace-nowrap">Person you are referring</span><div className="flex-1 h-px bg-border"/>
                  </div>
                  <p className="text-[0.76rem] text-sub mb-3 leading-snug">Share whatever you have. Even a name helps us make a good first impression.</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <FInput id="r-fn" label={<>Their First Name</>} placeholder="John"/>
                    <FInput id="r-ln" label={<>Their Last Name</>} placeholder="Smith"/>
                  </div>
                  <FInput id="r-em" label={<>Their Email <FLNote>(if you have it)</FLNote></>} type="email" placeholder="john@company.com"/>
                  <FInput id="r-ph" label={<>Their Phone <FLNote>(if you have it)</FLNote></>} type="tel" placeholder="(713) 555-0100"/>
                  <FTextarea id="r-notes" label="Notes for us" placeholder="Their situation, what they have mentioned, the best way to approach them." rows={3}/>
                </>
              )}
              <FG>
                <FL>How did you hear about AxisPoint?</FL>
                <div className="flex flex-wrap gap-1.5">
                  {['Personal referral','Networking event','This business card','Other'].map(v=>(
                    <ChipS key={v} label={v} sel={sourceSel===v} onClick={()=>setSourceSel(sourceSel===v?null:v)}/>
                  ))}
                </div>
              </FG>
              <FTextarea id="c-msg" label="Anything else?" placeholder="Questions, context, anything helpful." rows={2}/>
              <div className="flex gap-2 mt-5"><NavBack onClick={goBack}/><NavNext onClick={goNext}/></div>
            </div>
          )}

          {/* ── Comms prefs (final step) ── */}
          {step === 'comms' && (
            <div>
              <SQ>Stay in the loop</SQ>
              <SHint>Optional. Choose what is relevant to you.</SHint>
              <div className="flex flex-col gap-2.5 mt-3.5">
                <PrefItem val="articles" title="New articles and insights" desc="When Zachary or Ethaniel publish something new."/>
                <PrefItem val="opportunities" title="Investment opportunities" desc="When a deal worth sharing comes across our desk."/>
                <PrefItem val="firm" title="Firm updates" desc="What AxisPoint is working on and firm news."/>
              </div>
              <p className="text-[0.7rem] text-hint mt-2.5 leading-relaxed">You can unsubscribe from any of these at any time.</p>
              <div className="flex gap-2 mt-5">
                <NavBack onClick={goBack}/>
                <button type="button" disabled={submitting} onClick={submitForm}
                  className="flex-1 py-3 px-4 rounded-[9px] border-none text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:brightness-[1.08] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{background:'#9F328C'}}
                >
                  {submitting ? 'Sending…' : 'Send to AxisPoint'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Booking ── */}
          {step === 'booking' && (
            <div>
              <SQ>Would you like to book a call?</SQ>
              <SHint>30 minutes, Monday through Friday, 8am to 5pm CT. Totally optional.</SHint>
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {[{ id:'yes' as const, icon:'📅', label:'Yes, book a call', desc:'Pick a time right now'},
                  { id:'no'  as const, icon:'✉️', label:'No, just submit',   desc:'We will reach out to you'}].map(opt=>{
                  const sel = bookChoice===opt.id;
                  return (
                    <div key={opt.id} onClick={()=>setBookChoice(opt.id)}
                      className={`rounded-[12px] border cursor-pointer transition-all p-4 text-center relative ${sel?'border-teal bg-[#E8F7FA]':'border-border bg-body hover:border-[#D4CEE8] hover:bg-white hover:-translate-y-0.5'}`}
                    >
                      <div className={`mx-auto mb-2.5 w-4 h-4 rounded-full border flex items-center justify-center text-[0.52rem] transition-all ${sel?'border-teal bg-teal text-white':'border-[#D4CEE8] text-transparent'}`}>✓</div>
                      <span className="text-xl block mb-1.5">{opt.icon}</span>
                      <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{opt.label}</div>
                      <div className="text-[0.7rem] text-sub leading-snug">{opt.desc}</div>
                    </div>
                  );
                })}
              </div>
              {bookChoice === 'yes' && (
                <div className="bg-body border border-border rounded-[14px] p-4 mb-5">
                  <div className="flex items-center justify-between mb-4">
                    <button type="button" disabled={!canPrevMonth} onClick={()=>changeMonth(-1)} className="w-[30px] h-[30px] rounded-[7px] border border-border bg-white flex items-center justify-center text-sub cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink disabled:opacity-25 disabled:cursor-not-allowed">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div className="font-serif font-semibold text-ink" style={{fontSize:'1.08rem'}}>{MONTHS[calMonth]} {calYear}</div>
                    <button type="button" onClick={()=>changeMonth(1)} className="w-[30px] h-[30px] rounded-[7px] border border-border bg-white flex items-center justify-center text-sub cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {DAYS.map(d=><div key={d} className="text-center text-[0.6rem] font-semibold tracking-[0.06em] uppercase text-hint py-0.5">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 mb-4">
                    {calCells.map((d,i)=>{
                      if (!d) return <div key={i}/>;
                      const past=isPast(d), wknd=isWknd(d,i), avail=!past&&!wknd, sel=selDay===d;
                      return (
                        <div key={i} onClick={()=>avail&&setSelDay(d)}
                          className={`aspect-square rounded-[8px] flex items-center justify-center text-[0.8rem] font-medium transition-all ${
                            sel   ?'bg-purple text-white border border-purple scale-105':
                            avail ?'bg-white border border-border text-ink cursor-pointer hover:bg-[#EEEAF5] hover:border-[#C4B8DC] hover:text-purple hover:scale-[1.06]':
                                   'text-[#D4CEE8] cursor-default'
                          }`}
                        >{d}</div>
                      );
                    })}
                  </div>
                  {selDay !== null && (
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full border text-[0.72rem] font-semibold" style={{background:'#EEEAF5',borderColor:'#C4B8DC',color:'#38285D'}}>{MONTHS[calMonth]} {selDay}</div>
                        <span className="text-[0.72rem] text-hint">Pick a time</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SLOTS.map(s=>(
                          <button key={s} type="button" disabled={TAKEN.has(s)} onClick={()=>!TAKEN.has(s)&&setSelSlot(s)}
                            className={`py-2 rounded-[8px] border text-center text-[0.75rem] font-semibold transition-all ${
                              TAKEN.has(s)?'bg-body border-border text-[#D4CEE8] cursor-not-allowed line-through font-normal':
                              selSlot===s ?'bg-teal border-teal text-white shadow-[0_2px_8px_rgba(36,165,188,.25)]':
                                           'bg-white border-border text-sub cursor-pointer hover:border-teal/40 hover:bg-[#E8F7FA] hover:text-teal'
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                      <div className="text-[0.65rem] text-hint mt-1.5">All times in Central Time (CT)</div>
                    </div>
                  )}
                  {selSlot !== null && (
                    <div className="mt-4">
                      <FL>How would you like to meet?</FL>
                      <div className="grid grid-cols-2 gap-2 mb-2.5">
                        {[{id:'meet' as MeetType,label:'Google Meet',desc:'We will send a video link'},{id:'phone' as MeetType,label:'Phone Call',desc:'We will call you'}].map(opt=>(
                          <div key={opt.id!} onClick={()=>setMeetType(opt.id)} className={`rounded-[9px] border cursor-pointer transition-all p-3 text-center ${meetType===opt.id?'border-teal bg-[#E8F7FA]':'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'}`}>
                            <div className="text-[0.78rem] font-semibold text-ink mb-0.5">{opt.label}</div>
                            <div className="text-[0.66rem] text-sub">{opt.desc}</div>
                          </div>
                        ))}
                      </div>
                      {meetType==='phone' && <FInput id="cal-phone" label="Your phone number" type="tel" placeholder="(713) 555-0100"/>}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <NavBack onClick={goBack}/>
                <NavNext onClick={goNext} disabled={!bookChoice} label="Continue"/>
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-3 py-3.5 text-center">
              <div className="w-[52px] h-[52px] rounded-full border-2 bg-[#E8F7FA] flex items-center justify-center text-teal text-[22px]"
                style={{borderColor:'#24a5bc', animation:'pop 0.42s cubic-bezier(0.175,0.885,0.32,1.275) both'}}>
                ✓
              </div>
              <style>{`@keyframes pop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
              <div className="font-serif font-semibold text-ink" style={{fontSize:'1.28rem'}}>You are on our radar.</div>
              <p className="text-[0.82rem] text-sub leading-relaxed max-w-[320px]">Expect a personal reach-out within one business day.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── QR code section ── */}
      <div className="w-full bg-white border border-border rounded-[20px] overflow-hidden shadow-card text-center">
        <div className="h-[3px]" style={{background:'linear-gradient(90deg,#24A5BC,#38285D)'}}/>
        <div className="p-[26px_22px]">
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
            <div className="text-[0.68rem] text-hint max-w-[230px] leading-relaxed">Scan from the screen or screenshot and share in any app.</div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <a href="https://axispoint.llc" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border no-underline text-sub text-[0.78rem] font-medium transition-all hover:border-purple hover:text-purple hover:bg-[#EEEAF5]"
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
