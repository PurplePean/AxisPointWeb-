/**
 * Step 4 — Contact details (role-branched). Copied verbatim from
 * apps/web/src/pages/ContactPage.tsx (`step === 'contact'`).
 */
import type { FormController } from '../types';
import { SQ, SH3, FL, FLNote, ChipS, FInput, FTextarea, SectionDivider, NavBack, NavNext } from '../primitives';

export function Step4Contact({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>{c.role === 'refer' ? 'Your referral details' : 'How do we reach you?'}</SQ>
      <SH3>{c.role === 'refer' ? 'Share whatever you know about them — even just a name helps.' : 'We will follow up personally.'}</SH3>

      {c.role === 'refer' ? (
        <>
          {/* Section 1: Person being referred */}
          <SectionDivider label="Person you are referring" />
          <p className="text-[0.77rem] text-sub mb-3 leading-snug">Share whatever you know. Even just a name helps us make a good first impression.</p>
          <div className="grid grid-cols-2 gap-3">
            <FInput id="r-fn" label={<>First Name <FLNote>(optional)</FLNote></>} placeholder="John" />
            <FInput id="r-ln" label={<>Last Name <FLNote>(optional)</FLNote></>} placeholder="Smith" />
          </div>
          <FInput id="r-em" label={<>Email <FLNote>(optional)</FLNote></>} type="email" placeholder="john@company.com" />
          <FInput id="r-ph" label={<>Phone <FLNote>(optional)</FLNote></>} type="tel" placeholder="(713) 555-0100" />
          <FTextarea id="r-notes" label="Notes about them" placeholder="Their situation, what they have mentioned, or the best way to approach them." rows={3} />

          {/* Section 2: Referrer (submitter) info */}
          <SectionDivider label="Your information" />
          <div className="grid grid-cols-2 gap-3">
            <FInput id="c-fn" label={<>First Name *</>} placeholder="Jane" autocomplete="given-name" />
            <FInput id="c-ln" label={<>Last Name *</>} placeholder="Smith" autocomplete="family-name" />
          </div>
          <FInput id="c-em" label={<>Email *</>} type="email" placeholder="jane@company.com" autocomplete="email" />
          <FInput id="c-ph" label="Phone" type="tel" placeholder="(713) 555-0100" autocomplete="tel" />
          <FInput id="c-co" label="Company or Firm" placeholder="Your company" autocomplete="organization" />
          <FTextarea id="c-msg" label="Message" placeholder="Anything else we should know." rows={3} />
        </>
      ) : (
        <>
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
                <ChipS key={v} label={v} sel={c.sourceSel===v} onClick={() => c.setSourceSel(c.sourceSel===v ? null : v)} />
              ))}
            </div>
          </div>
          <FTextarea id="c-msg" label="Anything else?" placeholder="Questions, context, or anything helpful." rows={3} />

          {/* Referral capture for non-refer paths */}
          {!c.urlRef && (
            <div className="mt-2 mb-3.5 rounded-[12px] border border-border bg-body p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.8rem] font-medium text-ink">Were you referred to us?</span>
                <div className="flex rounded-full border border-border overflow-hidden text-[0.72rem] font-semibold">
                  {(['No', 'Yes'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => c.setIsReferred(opt === 'Yes')}
                      className={`px-3.5 py-1 transition-all cursor-pointer ${
                        (opt === 'Yes') === c.isReferred
                          ? 'bg-purple text-white'
                          : 'bg-transparent text-sub hover:text-ink'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              {c.isReferred && (
                <div>
                  <FL>Referral code, name, or email</FL>
                  <input
                    id="r-ref"
                    type="text"
                    placeholder="Enter their referral code, name, or email address"
                    className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5]"
                  />
                  <p className="text-[0.67rem] text-hint mt-1.5">We will make sure they get credit.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.captureContactAndAdvance} />
      </div>
    </div>
  );
}
