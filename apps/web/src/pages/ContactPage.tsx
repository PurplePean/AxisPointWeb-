import React, { useState, useEffect } from 'react';
import { team } from '@brand/team';
import { useReveal } from '../hooks/useReveal';

const FORM_ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT as string | undefined;

type Role = 'investor' | 'referral' | 'pro' | 'curious' | 'refer';
type Step = 'role' | 'context' | 'prefs' | 'contact' | 'comms' | 'booking' | 'success';
type MeetType = 'meet' | 'phone' | null;

const STEP_ORDER_INVESTOR: Step[] = ['role', 'context', 'prefs', 'contact', 'booking', 'comms'];
const STEP_ORDER_OTHER: Step[]   = ['role', 'context',          'contact', 'booking', 'comms'];

const STEP_LABELS_INVESTOR = ['Who you are', 'Background', 'Preferences', 'Your info', 'Book a call', 'Stay in the loop'];
const STEP_LABELS_OTHER    = ['Who you are', 'Background', 'Your info', 'Book a call', 'Stay in the loop'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const SLOTS  = ['8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
                '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'];
const TAKEN  = new Set(['9:00 AM','11:00 AM','2:00 PM','3:30 PM']);

function buildCalendar(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

function fmtDate(y: number, m: number, d: number) {
  return `${MONTHS[m]} ${d}, ${y}`;
}

/* ── Chip helpers ── */
function ChipS({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
        sel ? 'border-purple bg-[#EEEAF5] text-purple' : 'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function ChipM({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
        sel ? 'border-teal bg-[#E8F7FA] text-teal' : 'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function CapC({ label, sel, dim, onClick }: { label: string; sel: boolean; dim?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 px-1 rounded-[10px] border text-xs font-semibold transition-all cursor-pointer text-center leading-snug ${
        sel ? 'border-[#9F328C] bg-[#F5EAF4] text-[#9F328C]' :
        dim && !sel ? 'border-border bg-white text-sub/40 hover:text-sub hover:border-[#D4CEE8]' :
        'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/* ── Field label ── */
function FL({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.63rem] font-semibold text-sub uppercase tracking-[0.09em] mb-1.5 flex items-center gap-1">
      {children}
    </div>
  );
}

function FLNote({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.6rem] font-normal normal-case tracking-normal text-hint">{children}</span>;
}

function FInput({ id, label, type = 'text', placeholder, autocomplete }: {
  id: string; label: React.ReactNode; type?: string; placeholder: string; autocomplete?: string;
}) {
  return (
    <div className="mb-3.5">
      <FL>{label}</FL>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autocomplete}
        className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm font-[Figtree,sans-serif] outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5]"
      />
    </div>
  );
}

function FTextarea({ id, label, placeholder, rows = 3 }: { id: string; label: string; placeholder: string; rows?: number; }) {
  return (
    <div className="mb-3.5">
      <FL>{label}</FL>
      <textarea
        id={id}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5] resize-y leading-snug min-h-[76px]"
      />
    </div>
  );
}

/* ── Progress ── */
function Progress({ stepOrder, currentStep }: { stepOrder: Step[]; currentStep: Step }) {
  const labels = stepOrder.length === 6 ? STEP_LABELS_INVESTOR : STEP_LABELS_OTHER;
  const cur = stepOrder.indexOf(currentStep);
  return (
    <div className="mb-6">
      <div className="flex items-center">
        {stepOrder.map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[0.65rem] font-semibold flex-shrink-0 z-10 transition-all ${
                i < cur  ? 'border-teal bg-teal text-white' :
                i === cur ? 'border-purple bg-[#EEEAF5] text-purple' :
                            'border-[#D4CEE8] bg-white text-hint'
              }`}
            >
              {i < cur ? '✓' : i + 1}
            </div>
            {i < stepOrder.length - 1 && (
              <div
                className="flex-1 h-[1.5px] transition-all"
                style={{ background: i < cur ? 'linear-gradient(90deg,#24a5bc,#38285d)' : '#E8E4F0' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex mt-1.5">
        {labels.map((lbl, i) => (
          <span
            key={lbl}
            className={`flex-1 text-[0.58rem] font-medium transition-colors ${
              i === cur ? 'text-purple' : i < cur ? 'text-teal' : 'text-hint'
            } ${i === 0 ? 'text-left' : i === labels.length - 1 ? 'text-right' : 'text-center'}`}
          >
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Nav buttons ── */
function NavBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 rounded-[10px] border border-border bg-transparent text-sub text-[0.82rem] font-medium cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink flex-shrink-0"
    >
      Back
    </button>
  );
}

function NavNext({ onClick, disabled, label = 'Continue' }: { onClick: () => void; disabled?: boolean; label?: string; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 px-4 rounded-[10px] border-none bg-purple text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none"
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════ */
function ContactPage() {
  useReveal();

  const [step, setStep]       = useState<Step>('role');
  const [role, setRole]       = useState<Role | null>(null);
  const [bookChoice, setBookChoice] = useState<'yes' | 'no' | null>(null);
  const [meetType, setMeetType]     = useState<MeetType>(null);
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);
  const [selSlot, setSelSlot]   = useState<string | null>(null);

  /* multi-select state */
  const [expSel,       setExpSel]       = useState<Set<string>>(new Set());
  const [aumSel,       setAumSel]       = useState<string | null>(null);
  const [profSel,      setProfSel]      = useState<string | null>(null);
  const [clientsSel,   setClientsSel]   = useState<Set<string>>(new Set());
  const [refIntentSel, setRefIntentSel] = useState<string | null>(null);
  const [proRoleSel,   setProRoleSel]   = useState<string | null>(null);
  const [marketSel,    setMarketSel]    = useState<Set<string>>(new Set());
  const [proIntentSel, setProIntentSel] = useState<string | null>(null);
  const [curiousSel,   setCuriousSel]   = useState<Set<string>>(new Set());
  const [journeySel,   setJourneySel]   = useState<string | null>(null);
  const [relSel,       setRelSel]       = useState<string | null>(null);
  const [fitSel,       setFitSel]       = useState<Set<string>>(new Set());
  const [awareSel,     setAwareSel]     = useState<string | null>(null);
  const [assetSel,     setAssetSel]     = useState<Set<string>>(new Set());
  const [timelineSel,  setTimelineSel]  = useState<string | null>(null);
  const [sourceSel,    setSourceSel]    = useState<string | null>(null);
  const [prefsSel,     setPrefsSel]     = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);

  const stepOrder = role === 'investor' ? STEP_ORDER_INVESTOR : STEP_ORDER_OTHER;

  function goNext() {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
    else setStep('success');
  }

  function goBack() {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  }

  function pickRole(r: Role) {
    setRole(r);
  }

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setFn(next);
  }

  useEffect(() => {
    setSelDay(null);
    setSelSlot(null);
  }, [calMonth, calYear]);

  useEffect(() => {
    if (selDay !== null) setSelSlot(null);
  }, [selDay]);

  const today = new Date();
  const calCells = buildCalendar(calYear, calMonth);
  const isPast  = (d: number) => new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isWknd  = (_d: number, idx: number) => {
    const col = (idx) % 7;
    return col === 0 || col === 6;
  };

  /* ── Step 2 back destination ── */
  function s2Next() {
    if (role === 'investor') setStep('prefs');
    else setStep('contact');
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
      page: 'axispoint.llc',
      ...(role === 'refer' ? {
        referred: {
          name: [
            (document.getElementById('r-fn') as HTMLInputElement | null)?.value.trim(),
            (document.getElementById('r-ln') as HTMLInputElement | null)?.value.trim(),
          ].filter(Boolean).join(' '),
          email: (document.getElementById('r-em') as HTMLInputElement | null)?.value.trim() ?? '',
          phone: (document.getElementById('r-ph') as HTMLInputElement | null)?.value.trim() ?? '',
          notes: (document.getElementById('r-notes') as HTMLTextAreaElement | null)?.value.trim() ?? '',
        },
      } : {}),
    };
    try {
      if (FORM_ENDPOINT) {
        await fetch(FORM_ENDPOINT, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    } catch {
      // fail silently — show success regardless so leads are not blocked
    } finally {
      setSubmitting(false);
      setStep('success');
    }
  }

  const { zach, ethaniel } = team;

  /* ── Role tile ── */
  function RoleTile({
    r, icon, label, desc, wide,
  }: { r: Role; icon: React.ReactNode; label: string; desc: string; wide?: boolean }) {
    const sel = role === r;
    return (
      <div
        onClick={() => pickRole(r)}
        className={`rounded-[13px] border cursor-pointer transition-all relative ${wide ? 'flex items-center gap-3 py-3 px-3.5' : 'p-3.5'} ${
          sel ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:-translate-y-0.5 hover:bg-white'
        }`}
        style={wide ? { gridColumn: '1/-1' } : {}}
      >
        <div
          className={`absolute top-2 right-2 w-[15px] h-[15px] rounded-full border flex items-center justify-center text-[0.52rem] transition-all ${
            sel ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
          }`}
          style={wide ? { position: 'static', flexShrink: 0 } : {}}
        >
          ✓
        </div>
        <div className="w-8 h-8 rounded-[8px] bg-body border border-border flex items-center justify-center mb-2 flex-shrink-0" style={wide ? { marginBottom: 0 } : {}}>
          {icon}
        </div>
        <div>
          <div className="text-[0.82rem] font-semibold text-ink mb-0.5">{label}</div>
          <div className="text-[0.68rem] text-sub leading-snug">{desc}</div>
        </div>
      </div>
    );
  }

  /* ── Pref toggle ── */
  function PrefItem({ val, title, desc }: { val: string; title: string; desc: string }) {
    const on = prefsSel.has(val);
    return (
      <div
        onClick={() => toggleSet(prefsSel, setPrefsSel, val)}
        className={`flex items-start gap-3 px-4 py-3.5 border rounded-xl cursor-pointer transition-all ${
          on ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
        }`}
      >
        <div className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
          on ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] bg-white'
        }`}>
          {on && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
        <div>
          <div className="text-[0.875rem] font-semibold text-ink mb-0.5">{title}</div>
          <div className="text-[0.76rem] text-sub leading-snug">{desc}</div>
        </div>
      </div>
    );
  }

  /* ── Booking cal ── */
  function CalDay({ d, cellIdx }: { d: number | null; cellIdx: number }) {
    if (d === null) return <div />;
    const past  = isPast(d);
    const wknd  = isWknd(d, cellIdx);
    const avail = !past && !wknd;
    const sel   = selDay === d;
    return (
      <div
        onClick={() => avail && setSelDay(d)}
        className={`aspect-square rounded-[7px] flex items-center justify-center text-[0.78rem] font-medium transition-all ${
          sel   ? 'bg-purple text-white border border-purple scale-105' :
          avail ? 'bg-white border border-border text-ink cursor-pointer hover:bg-[#EEEAF5] hover:border-[#C4B8DC] hover:text-purple hover:scale-[1.08]' :
                  'text-[#D4CEE8] cursor-default'
        }`}
      >
        {d}
      </div>
    );
  }

  const canPrevMonth = !(calYear === today.getFullYear() && calMonth === today.getMonth());
  function changeMonth(dir: -1 | 1) {
    let m = calMonth + dir;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setCalMonth(m); setCalYear(y);
  }

  /* ── SQ heading ── */
  function SQ({ children }: { children: React.ReactNode }) {
    return <div className="font-serif font-semibold text-ink mb-1 leading-snug" style={{ fontSize: '1.18rem' }}>{children}</div>;
  }
  function SH3({ children }: { children: React.ReactNode }) {
    return <div className="text-[0.8rem] text-sub leading-relaxed mb-4">{children}</div>;
  }

  /* ── Render current step ── */
  const isSuccess = step === 'success';
  const showProgress = !isSuccess;

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative pt-[calc(68px+56px)] pb-14 overflow-hidden text-center" style={{ background: 'linear-gradient(135deg,#2A1E47 0%,#1C1628 100%)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full" style={{ background: 'rgba(36,165,188,0.10)', filter: 'blur(70px)' }} />
          <div className="absolute bottom-[-60px] left-[5%] w-[280px] h-[280px] rounded-full" style={{ background: 'rgba(159,50,140,0.08)', filter: 'blur(70px)' }} />
        </div>
        <div className="relative max-w-[640px] mx-auto px-7">
          <div className="rv inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/15 border border-teal/25 text-teal text-[0.68rem] font-semibold tracking-[0.1em] uppercase mb-5">
            <span className="w-[5px] h-[5px] rounded-full bg-teal" />
            Get in Touch
          </div>
          <h1 className="rv d1 font-serif font-semibold text-white leading-[1.1] mb-3.5" style={{ fontSize: 'clamp(2.2rem,4vw,3.2rem)' }}>
            Tell us who you are.<br />
            <em className="not-italic text-teal">We will take it from there.</em>
          </h1>
          <p className="rv d2 text-white/60 leading-[1.7]" style={{ fontSize: '1rem' }}>
            A few quick questions so we can reach out with the right context and connect you with the right person.
          </p>
        </div>
      </section>

      {/* Main layout */}
      <div className="max-w-[1100px] mx-auto px-7 py-16 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">

        {/* Form shell */}
        <div className="rv bg-white border border-border rounded-[22px] p-9 shadow-card">

          {showProgress && <Progress stepOrder={stepOrder} currentStep={step} />}

          {/* ── Step 1: Role ── */}
          {step === 'role' && (
            <div>
              <SQ>Who are you?</SQ>
              <SH3>Pick the option that fits best. The form adapts from here.</SH3>
              <div className="grid grid-cols-2 gap-[9px]">
                <RoleTile r="investor" label="Investor" desc="Looking to place capital in CRE"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                />
                <RoleTile r="referral" label="Referral Partner" desc="CPA, attorney, advisor"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                />
                <RoleTile r="pro" label="RE Professional" desc="Broker, lender, developer"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>}
                />
                <RoleTile r="curious" label="Exploring CRE" desc="Learning, just starting out"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A5270" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                />
                <RoleTile r="refer" label="Referring Someone" desc="I know someone who might be a fit and want to make the intro" wide
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A5270" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                />
              </div>
              <div className="flex gap-2 mt-5">
                <NavNext onClick={() => setStep('context')} disabled={!role} />
              </div>
            </div>
          )}

          {/* ── Step 2: Context (role-branched) ── */}
          {step === 'context' && (
            <div>
              {role === 'investor' && (
                <>
                  <SQ>Your investor background</SQ>
                  <SH3>Helps us understand deal fit and how to frame the conversation.</SH3>
                  <div className="mb-3.5">
                    <FL>Capital available for CRE</FL>
                    <div className="grid grid-cols-3 gap-[7px]">
                      {['Under $500K','$500K to $1M','$1M to $3M','$3M to $10M','$10M or more','Prefer not to say'].map((v,i) => (
                        <CapC key={v} label={v} sel={aumSel===v} dim={i<2} onClick={() => setAumSel(aumSel===v ? null : v)} />
                      ))}
                    </div>
                    <div className="text-[0.67rem] text-hint mt-1.5 leading-relaxed">Our typical minimum is $1M per deal. Lower tiers are here so we can stay in touch as your position grows.</div>
                  </div>
                  <div className="mb-3.5">
                    <FL>Prior CRE involvement <FLNote>(select all)</FLNote></FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Never invested in CRE','Residential properties','Passive LP in a syndication','Direct commercial ownership','1031 exchange experience','Institutional background'].map(v => (
                        <ChipM key={v} label={v} sel={expSel.has(v)} onClick={() => toggleSet(expSel, setExpSel, v)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {role === 'referral' && (
                <>
                  <SQ>About your practice</SQ>
                  <SH3>We partner with professionals who serve high-net-worth and business-owner clients.</SH3>
                  <div className="mb-3.5">
                    <FL>Your profession</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['CPA or Tax Advisor','Attorney','Financial Advisor or RIA','Wealth Manager','Insurance or Estate Planning','Other'].map(v => (
                        <ChipS key={v} label={v} sel={profSel===v} onClick={() => setProfSel(profSel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>Client base <FLNote>(select all)</FLNote></FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['High-net-worth individuals','Business owners','Real estate investors','General affluent clients'].map(v => (
                        <ChipM key={v} label={v} sel={clientsSel.has(v)} onClick={() => toggleSet(clientsSel, setClientsSel, v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>What brings you here?</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['I actively refer CRE opportunities','I have a specific client in mind','Building a referral relationship','Exploring if there is a fit'].map(v => (
                        <ChipS key={v} label={v} sel={refIntentSel===v} onClick={() => setRefIntentSel(refIntentSel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {role === 'pro' && (
                <>
                  <SQ>Your CRE work</SQ>
                  <SH3>Tell us what you do. We are always open to smart collaborations.</SH3>
                  <div className="mb-3.5">
                    <FL>Primary role</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Investment Sales or Brokerage','Property Management','Lending or Finance','Development or Construction','Real Estate Attorney','Other'].map(v => (
                        <ChipS key={v} label={v} sel={proRoleSel===v} onClick={() => setProRoleSel(proRoleSel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>Market focus <FLNote>(select all)</FLNote></FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Houston','DFW','Austin or San Antonio','Sun Belt','National'].map(v => (
                        <ChipM key={v} label={v} sel={marketSel.has(v)} onClick={() => toggleSet(marketSel, setMarketSel, v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>How can we work together?</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Deal collaboration','JV or co-investment','Client referral','Networking'].map(v => (
                        <ChipS key={v} label={v} sel={proIntentSel===v} onClick={() => setProIntentSel(proIntentSel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {role === 'curious' && (
                <>
                  <SQ>What is on your mind?</SQ>
                  <SH3>No experience needed. Tell us what you are trying to understand.</SH3>
                  <div className="mb-3.5">
                    <FL>What interests you? <FLNote>(select all)</FLNote></FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Passive income from real estate','How syndications work','1031 exchange strategies','Tax advantages of CRE','Building long-term wealth','Deal analysis basics'].map(v => (
                        <ChipM key={v} label={v} sel={curiousSel.has(v)} onClick={() => toggleSet(curiousSel, setCuriousSel, v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>Where are you financially?</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Saving toward my first investment','Have capital but not sure where to start','In stocks and curious about CRE','Already own residential real estate'].map(v => (
                        <ChipS key={v} label={v} sel={journeySel===v} onClick={() => setJourneySel(journeySel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {role === 'refer' && (
                <>
                  <SQ>Tell us about the connection</SQ>
                  <SH3>We will use this to make a warm, informed introduction.</SH3>
                  <div className="mb-3.5">
                    <FL>Your relationship to them</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Family member','Friend','Business partner or colleague','Client','Met recently'].map(v => (
                        <ChipS key={v} label={v} sel={relSel===v} onClick={() => setRelSel(relSel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>Why might they be a fit? <FLNote>(select all)</FLNote></FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Has significant investable capital','Has expressed interest in CRE','Looking for passive income','Wants to diversify from stocks','Has a 1031 exchange situation'].map(v => (
                        <ChipM key={v} label={v} sel={fitSel.has(v)} onClick={() => toggleSet(fitSel, setFitSel, v)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FL>Do they know you are reaching out?</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {['Yes, they are expecting a call','Not yet, I want to loop them in','I will handle the intro myself'].map(v => (
                        <ChipS key={v} label={v} sel={awareSel===v} onClick={() => setAwareSel(awareSel===v ? null : v)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 mt-5">
                <NavBack onClick={goBack} />
                <NavNext onClick={s2Next} />
              </div>
            </div>
          )}

          {/* ── Step 3: Investor prefs (investor only) ── */}
          {step === 'prefs' && (
            <div>
              <SQ>What you are looking for</SQ>
              <SH3>Help us match you with the right deals and the right specialist.</SH3>
              <div className="mb-3.5">
                <FL>Asset class interest <FLNote>(select all)</FLNote></FL>
                <div className="flex flex-wrap gap-1.5">
                  {['Multifamily','Industrial','Office','Retail','Mixed-Use','Self-Storage','Show me what fits'].map(v => (
                    <ChipM key={v} label={v} sel={assetSel.has(v)} onClick={() => toggleSet(assetSel, setAssetSel, v)} />
                  ))}
                </div>
              </div>
              <div className="mb-3.5">
                <FL>Investment timeline</FL>
                <div className="flex flex-wrap gap-1.5">
                  {['Ready to move now','Within 6 months','6 to 12 months','Just researching'].map(v => (
                    <ChipS key={v} label={v} sel={timelineSel===v} onClick={() => setTimelineSel(timelineSel===v ? null : v)} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <NavBack onClick={goBack} />
                <NavNext onClick={goNext} />
              </div>
            </div>
          )}

          {/* ── Contact step ── */}
          {step === 'contact' && (
            <div>
              <SQ>{role === 'refer' ? 'Tell us who you are and who to call' : 'How do we reach you?'}</SQ>
              <SH3>{role === 'refer' ? 'Share whatever you know about them — even just a name helps.' : 'We will follow up personally.'}</SH3>

              {role === 'refer' && (
                <>
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[0.62rem] font-semibold tracking-[0.09em] uppercase text-sub whitespace-nowrap">Person you are referring</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <p className="text-[0.77rem] text-sub mb-3 leading-snug">Share whatever you know. Even just a name helps us make a good first impression.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FInput id="r-fn" label="First Name" placeholder="John" />
                    <FInput id="r-ln" label="Last Name" placeholder="Smith" />
                  </div>
                  <FInput id="r-em" label={<>Email <FLNote>(if you have it)</FLNote></>} type="email" placeholder="john@company.com" />
                  <FInput id="r-ph" label={<>Phone <FLNote>(if you have it)</FLNote></>} type="tel" placeholder="(713) 555-0100" />
                  <FTextarea id="r-notes" label="Notes for us" placeholder="Their situation, what they have mentioned, or the best way to approach them." rows={3} />
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[0.62rem] font-semibold tracking-[0.09em] uppercase text-sub whitespace-nowrap">Your contact info</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FInput id="c-fn" label={<>First Name *</>} placeholder="Jane" autocomplete="given-name" />
                <FInput id="c-ln" label={<>Last Name *</>} placeholder="Smith" autocomplete="family-name" />
              </div>
              <FInput id="c-em" label={<>Email *</>} type="email" placeholder="jane@company.com" autocomplete="email" />
              <FInput id="c-ph" label="Phone" type="tel" placeholder="(713) 555-0100" autocomplete="tel" />
              <FInput id="c-co" label="Company or Firm" placeholder="Your company" autocomplete="organization" />
              <div className="mb-3.5">
                <FL>How did you hear about AxisPoint?</FL>
                <div className="flex flex-wrap gap-1.5">
                  {['Personal referral','LinkedIn','Networking event','Search','Other'].map(v => (
                    <ChipS key={v} label={v} sel={sourceSel===v} onClick={() => setSourceSel(sourceSel===v ? null : v)} />
                  ))}
                </div>
              </div>
              <FTextarea id="c-msg" label="Anything else?" placeholder="Questions, context, or anything helpful." rows={3} />

              <div className="flex gap-2 mt-5">
                <NavBack onClick={goBack} />
                <NavNext onClick={goNext} />
              </div>
            </div>
          )}

          {/* ── Comms prefs (final step) ── */}
          {step === 'comms' && (
            <div>
              <SQ>Stay in the loop</SQ>
              <SH3>Optional. Choose what is relevant to you and we will only send what you asked for.</SH3>
              <div className="flex flex-col gap-2.5 mt-3.5">
                <PrefItem val="articles" title="New articles and insights" desc="When Zachary or Ethaniel publish something new on the Learn page." />
                <PrefItem val="opportunities" title="Investment opportunities" desc="When a deal or acquisition opportunity worth sharing comes across our desk." />
                <PrefItem val="firm" title="Firm updates" desc="What AxisPoint is working on, new capabilities, and firm news." />
              </div>
              <p className="text-[0.7rem] text-hint mt-2.5 leading-relaxed">You can unsubscribe from any of these at any time. We do not share your information.</p>
              <div className="flex gap-2 mt-5">
                <NavBack onClick={goBack} />
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 rounded-[10px] border-none cursor-pointer flex items-center justify-center gap-1.5 text-sm font-semibold text-white transition-all hover:brightness-[1.08] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: '#9F328C' }}
                >
                  {submitting ? 'Sending…' : 'Send to AxisPoint'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Booking ── */}
          {step === 'booking' && (
            <div>
              <SQ>Would you like to book a call?</SQ>
              <SH3>30 minutes, Monday through Friday, 8am to 5pm CT. Totally optional.</SH3>

              <div className="grid grid-cols-2 gap-2.5 mt-4">
                {[
                  { id: 'yes' as const, label: 'Yes, book a time now', desc: 'Pick a slot and we will confirm' },
                  { id: 'no' as const,  label: 'No, just send my info',  desc: 'We will reach out within one business day' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setBookChoice(opt.id)}
                    className={`rounded-[13px] border cursor-pointer transition-all relative p-4 ${
                      bookChoice === opt.id ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white hover:-translate-y-0.5'
                    }`}
                  >
                    <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-full border flex items-center justify-center text-[0.55rem] transition-all ${
                      bookChoice === opt.id ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
                    }`}>✓</div>
                    <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{opt.label}</div>
                    <div className="text-[0.72rem] text-sub">{opt.desc}</div>
                  </div>
                ))}
              </div>

              {bookChoice === 'yes' && (
                <div className="mt-4 bg-body border border-border rounded-[14px] p-5">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-3.5">
                    <button
                      type="button"
                      onClick={() => changeMonth(-1)}
                      disabled={!canPrevMonth}
                      className="w-7 h-7 rounded-[7px] border border-border bg-white flex items-center justify-center text-sub cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div className="font-serif font-semibold text-ink" style={{ fontSize: '1.05rem' }}>{MONTHS[calMonth]} {calYear}</div>
                    <button
                      type="button"
                      onClick={() => changeMonth(1)}
                      className="w-7 h-7 rounded-[7px] border border-border bg-white flex items-center justify-center text-sub cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {DAYS.map(d => (
                      <div key={d} className="text-center text-[0.6rem] font-semibold tracking-[0.06em] uppercase text-hint py-0.5">{d}</div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-0.5 mb-3.5">
                    {calCells.map((d, i) => <CalDay key={i} d={d} cellIdx={i} />)}
                  </div>

                  {/* Time slots */}
                  {selDay !== null && (
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[0.7rem] font-semibold" style={{ background: '#EEEAF5', borderColor: '#C4B8DC', color: '#38285D' }}>
                          {fmtDate(calYear, calMonth, selDay)}
                        </div>
                        <span className="text-[0.72rem] text-hint">Pick a time</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SLOTS.map(s => (
                          <button
                            key={s}
                            type="button"
                            disabled={TAKEN.has(s)}
                            onClick={() => !TAKEN.has(s) && setSelSlot(s)}
                            className={`py-2 rounded-[8px] border text-center text-[0.72rem] font-semibold transition-all ${
                              TAKEN.has(s)   ? 'bg-body border-border text-[#D4CEE8] cursor-not-allowed line-through font-normal' :
                              selSlot === s  ? 'bg-teal border-teal text-white' :
                                               'bg-white border-border text-sub cursor-pointer hover:border-teal/40 hover:bg-[#E8F7FA] hover:text-teal'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="text-[0.63rem] text-hint mt-1.5">All times Central Time (CT)</div>
                    </div>
                  )}

                  {/* Meet type */}
                  {selSlot !== null && (
                    <div className="mt-4">
                      <FL>How would you like to meet?</FL>
                      <div className="grid grid-cols-2 gap-2 mb-2.5">
                        {[
                          { id: 'meet' as MeetType, label: 'Google Meet', desc: 'We will send a video link' },
                          { id: 'phone' as MeetType, label: 'Phone Call', desc: 'We will call you' },
                        ].map(opt => (
                          <div
                            key={opt.id!}
                            onClick={() => setMeetType(opt.id)}
                            className={`rounded-[11px] border cursor-pointer transition-all p-3 text-center ${
                              meetType === opt.id ? 'border-purple bg-[#EEEAF5]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
                            }`}
                          >
                            <div className="text-[0.82rem] font-semibold text-ink mb-0.5">{opt.label}</div>
                            <div className="text-[0.7rem] text-sub">{opt.desc}</div>
                          </div>
                        ))}
                      </div>
                      {meetType === 'phone' && (
                        <FInput id="cal-phone" label="Your phone number" type="tel" placeholder="(713) 555-0100" />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <NavBack onClick={goBack} />
                <NavNext onClick={goNext} disabled={!bookChoice} label="Continue" />
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-3 py-3.5 text-center">
              <div
                className="w-[52px] h-[52px] rounded-full border-2 bg-[#E8F7FA] flex items-center justify-center text-teal text-[22px]"
                style={{ borderColor: '#24a5bc', animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) both' }}
              >
                ✓
              </div>
              <style>{`@keyframes pop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
              <div className="font-serif font-semibold text-ink" style={{ fontSize: '1.3rem' }}>You are on our radar.</div>
              <p className="text-[0.82rem] text-sub leading-relaxed max-w-[320px]">
                We will reach out personally, usually within one business day.
              </p>
              <div className="flex flex-col gap-2 w-full mt-1">
                {[
                  { member: zach, color: '#24A5BC', bg: '#E8F7FA', border: '#B8E6EF' },
                  { member: ethaniel, color: '#38285D', bg: '#EEEAF5', border: '#C4B8DC' },
                ].map(({ member, color, bg, border }) => (
                  <div key={member.id} className="flex items-center gap-2.5 bg-body border border-border rounded-[10px] py-2.5 px-3">
                    <div className="w-[30px] h-[30px] rounded-[7px] flex-shrink-0 flex items-center justify-center font-serif font-semibold text-[0.85rem]"
                      style={{ background: bg, border: `1px solid ${border}`, color }}>
                      {member.initials}
                    </div>
                    <div className="text-left">
                      <div className="text-[0.77rem] font-semibold text-ink">{member.fullName}</div>
                      <div className="text-[0.7rem] text-hint">{member.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div className="rv d1 flex flex-col gap-4">
          <div className="bg-white border border-border rounded-[18px] p-6 shadow-card">
            <div className="font-serif font-semibold text-ink mb-4" style={{ fontSize: '1.1rem' }}>Talk to us directly</div>

            <a href={`mailto:${zach.email}`} className="flex items-start gap-2.5 mb-3.5 no-underline text-inherit transition-opacity hover:opacity-75">
              <div className="w-[34px] h-[34px] rounded-[9px] flex-shrink-0 flex items-center justify-center" style={{ background: '#E8F7FA', border: '1px solid #B8E6EF' }}>
                <div className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center font-serif font-semibold text-[0.9rem]" style={{ background: '#E8F7FA', color: '#24A5BC' }}>ZR</div>
              </div>
              <div>
                <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{zach.fullName}</div>
                <div className="text-[0.7rem] text-hint mb-0.5">Partner — Multifamily</div>
                <div className="text-[0.76rem] text-teal">{zach.email}</div>
              </div>
            </a>

            <div className="h-px bg-border my-4" />

            <a href={`mailto:${ethaniel.email}`} className="flex items-start gap-2.5 no-underline text-inherit transition-opacity hover:opacity-75">
              <div className="w-[34px] h-[34px] rounded-[9px] flex-shrink-0 flex items-center justify-center" style={{ background: '#EEEAF5', border: '1px solid #C4B8DC' }}>
                <div className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center font-serif font-semibold text-[0.9rem]" style={{ background: '#EEEAF5', color: '#38285D' }}>EV</div>
              </div>
              <div>
                <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{ethaniel.fullName}</div>
                <div className="text-[0.7rem] text-hint mb-0.5">Partner — Commercial</div>
                <div className="text-[0.76rem] text-teal">{ethaniel.email}</div>
              </div>
            </a>

            <div className="h-px bg-border my-4" />
            <p className="text-[0.76rem] text-sub leading-relaxed">
              <strong className="text-ink font-semibold">Response time:</strong> We respond to every inquiry personally, typically within one business day.
            </p>
          </div>

          <div className="rounded-[18px] p-6" style={{ background: 'linear-gradient(135deg,#2A1E47,#1C1628)' }}>
            <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase mb-2.5" style={{ color: 'rgba(255,255,255,0.35)' }}>How we work</div>
            <blockquote className="font-serif italic leading-relaxed m-0" style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.85)' }}>
              We take the time to understand your goals before we ever look at an asset on your behalf.
            </blockquote>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ContactPage;
