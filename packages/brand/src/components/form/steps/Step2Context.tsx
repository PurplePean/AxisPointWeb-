/**
 * Step 2 — Role-branched context questions. Copied verbatim from
 * apps/web/src/pages/ContactPage.tsx (`step === 'context'`).
 */
import type { FormController } from '../types';
import { SQ, SH3, FL, FLNote, ChipS, ChipM, CapC, NavBack, NavNext } from '../primitives';

export function Step2Context({ c }: { c: FormController }) {
  return (
    <div>
      {c.role === 'investor' && (
        <>
          <SQ>Your investor background</SQ>
          <SH3>Helps us understand deal fit and how to frame the conversation.</SH3>
          <div className="mb-3.5">
            <FL>Capital available for CRE</FL>
            <div className="grid grid-cols-3 gap-[7px]">
              {['Under $500K','$500K to $1M','$1M to $3M','$3M to $10M','$10M or more','Prefer not to say'].map((v,i) => (
                <CapC key={v} label={v} sel={c.aumSel===v} dim={i<2} onClick={() => c.setAumSel(c.aumSel===v ? null : v)} />
              ))}
            </div>
            <div className="text-[0.67rem] text-hint mt-1.5 leading-relaxed">Our typical minimum is $1M per deal. Lower tiers are here so we can stay in touch as your position grows.</div>
          </div>
          <div className="mb-3.5">
            <FL>Prior CRE involvement <FLNote>(select all)</FLNote></FL>
            <div className="flex flex-wrap gap-1.5">
              {['Never invested in CRE','Residential properties','Passive LP in a syndication','Direct commercial ownership','1031 exchange experience','Institutional background'].map(v => (
                <ChipM key={v} label={v} sel={c.expSel.has(v)} onClick={() => c.toggleSet(c.expSel, c.setExpSel, v)} />
              ))}
            </div>
          </div>
        </>
      )}

      {c.role === 'referral' && (
        <>
          <SQ>About your practice</SQ>
          <SH3>We partner with professionals who serve high-net-worth and business-owner clients.</SH3>
          <div className="mb-3.5">
            <FL>Your profession</FL>
            <div className="flex flex-wrap gap-1.5">
              {['CPA or Tax Advisor','Attorney','Financial Advisor or RIA','Wealth Manager','Insurance or Estate Planning','Other'].map(v => (
                <ChipS key={v} label={v} sel={c.profSel===v} onClick={() => c.setProfSel(c.profSel===v ? null : v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>Client base <FLNote>(select all)</FLNote></FL>
            <div className="flex flex-wrap gap-1.5">
              {['High-net-worth individuals','Business owners','Real estate investors','General affluent clients'].map(v => (
                <ChipM key={v} label={v} sel={c.clientsSel.has(v)} onClick={() => c.toggleSet(c.clientsSel, c.setClientsSel, v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>What brings you here?</FL>
            <div className="flex flex-wrap gap-1.5">
              {['I actively refer CRE opportunities','I have a specific client in mind','Building a referral relationship','Exploring if there is a fit'].map(v => (
                <ChipS key={v} label={v} sel={c.refIntentSel===v} onClick={() => c.setRefIntentSel(c.refIntentSel===v ? null : v)} />
              ))}
            </div>
          </div>
        </>
      )}

      {c.role === 'pro' && (
        <>
          <SQ>Your CRE work</SQ>
          <SH3>Tell us what you do. We are always open to smart collaborations.</SH3>
          <div className="mb-3.5">
            <FL>Primary role</FL>
            <div className="flex flex-wrap gap-1.5">
              {['Investment Sales or Brokerage','Property Management','Lending or Finance','Development or Construction','Real Estate Attorney','Other'].map(v => (
                <ChipS key={v} label={v} sel={c.proRoleSel===v} onClick={() => c.setProRoleSel(c.proRoleSel===v ? null : v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>Market focus <FLNote>(select all)</FLNote></FL>
            <div className="flex flex-wrap gap-1.5">
              {['Houston','DFW','Austin or San Antonio','Sun Belt','National'].map(v => (
                <ChipM key={v} label={v} sel={c.marketSel.has(v)} onClick={() => c.toggleSet(c.marketSel, c.setMarketSel, v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>How can we work together?</FL>
            <div className="flex flex-wrap gap-1.5">
              {['Deal collaboration','JV or co-investment','Client referral','Networking'].map(v => (
                <ChipS key={v} label={v} sel={c.proIntentSel===v} onClick={() => c.setProIntentSel(c.proIntentSel===v ? null : v)} />
              ))}
            </div>
          </div>
        </>
      )}

      {c.role === 'curious' && (
        <>
          <SQ>What is on your mind?</SQ>
          <SH3>No experience needed. Tell us what you are trying to understand.</SH3>
          <div className="mb-3.5">
            <FL>What interests you? <FLNote>(select all)</FLNote></FL>
            <div className="flex flex-wrap gap-1.5">
              {['Passive income from real estate','How syndications work','1031 exchange strategies','Tax advantages of CRE','Building long-term wealth','Deal analysis basics'].map(v => (
                <ChipM key={v} label={v} sel={c.curiousSel.has(v)} onClick={() => c.toggleSet(c.curiousSel, c.setCuriousSel, v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>Where are you financially?</FL>
            <div className="flex flex-wrap gap-1.5">
              {['Saving toward my first investment','Have capital but not sure where to start','In stocks and curious about CRE','Already own residential real estate'].map(v => (
                <ChipS key={v} label={v} sel={c.journeySel===v} onClick={() => c.setJourneySel(c.journeySel===v ? null : v)} />
              ))}
            </div>
          </div>
        </>
      )}

      {c.role === 'refer' && (
        <>
          <SQ>About the person you are referring</SQ>
          <SH3>We will use this to make a warm, informed introduction.</SH3>
          <div className="mb-3.5">
            <FL>Your relationship to them</FL>
            <div className="flex flex-wrap gap-1.5">
              {['Client','Friend or family','Business partner or colleague','Met recently'].map(v => (
                <ChipS key={v} label={v} sel={c.relSel===v} onClick={() => c.setRelSel(c.relSel===v ? null : v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>Why might they be a fit? <FLNote>(select all)</FLNote></FL>
            <div className="flex flex-wrap gap-1.5">
              {['Has significant investable capital','Has expressed interest in CRE','Looking for passive income','Wants to diversify from stocks','Has a 1031 exchange situation'].map(v => (
                <ChipM key={v} label={v} sel={c.fitSel.has(v)} onClick={() => c.toggleSet(c.fitSel, c.setFitSel, v)} />
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <FL>Do they know you are reaching out?</FL>
            <div className="flex flex-wrap gap-1.5">
              {['Yes they are expecting a call','Not yet I want to loop them in','I will handle the intro myself'].map(v => (
                <ChipS key={v} label={v} sel={c.awareSel===v} onClick={() => c.setAwareSel(c.awareSel===v ? null : v)} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.s2Next} />
      </div>
    </div>
  );
}
