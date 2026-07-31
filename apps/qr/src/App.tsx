import { useEffect, useState } from 'react';
import Profile from './Profile';
import { allSelectableProfiles, resolveProfile, WEB_BASE_URL } from './profiles';

/**
 * QR business card (design@2026-07-30).
 *
 * One scan resolves to one partner. The visitor never picks a person. There is no
 * router here on purpose: the permanent public profile URL is an unresolved owner
 * decision, printed on the physical card and unrevisable after printing, so this pass
 * must not silently establish a routing contract by shipping one.
 *
 * The card therefore reads a local preview key. In production an unknown or absent key
 * resolves to the firm fallback, which is the approved behaviour for a card that does
 * not resolve.
 */
export default function App() {
  const isDev = import.meta.env.DEV;
  const [key, setKey] = useState<string | null>(() => new URLSearchParams(window.location.search).get('profile'));

  // Keep the preview key in sync with back and forward navigation in development.
  useEffect(() => {
    const onPop = () => setKey(new URLSearchParams(window.location.search).get('profile'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const profile = resolveProfile(key);

  function preview(next: string | null) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('profile', next);
    else url.searchParams.delete('profile');
    window.history.pushState({}, '', url);
    setKey(next);
  }

  return (
    <>
      <Profile profile={profile} />
      {isDev && <DevPreviewBar current={key} onSelect={preview} />}
    </>
  );
}

/**
 * Development-only preview selector.
 *
 * This exists so both partner profiles, the firm fallback, and the missing-data states
 * can be inspected without a backend. It is NOT the permanent public URL contract and
 * makes no claim to be one: the real card resolves a single printed URL per partner,
 * and that route is still an open owner decision.
 *
 * `import.meta.env.DEV` gates the whole component, so it is absent from production
 * output along with the dev-only state fixtures it lists.
 */
function DevPreviewBar({ current, onSelect }: { current: string | null; onSelect: (k: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const profiles = allSelectableProfiles();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="mx-auto w-full pointer-events-auto" style={{ maxWidth: 480 }}>
        {open && (
          <div className="bg-white border-t border-x border-[rgba(28,22,40,0.25)] p-3 text-left" style={{ fontSize: 13 }}>
            <p className="m-0 mb-2 text-[rgba(28,22,40,0.6)]" style={{ lineHeight: 1.5 }}>
              Local development preview only. Not the permanent profile URL, which is still an
              open owner decision. Save Contact is simulated and nothing leaves the browser.
            </p>
            <div className="grid gap-1.5">
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="text-left rounded-[2px] border border-[rgba(28,22,40,0.2)] px-2.5"
                style={{ minHeight: 44, fontWeight: current === null ? 700 : 500 }}
              >
                Firm fallback, no profile
              </button>
              {profiles.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onSelect(p.key)}
                  className="text-left rounded-[2px] border border-[rgba(28,22,40,0.2)] px-2.5"
                  style={{ minHeight: 44, fontWeight: current === p.key ? 700 : 500 }}
                >
                  {p.displayName}
                </button>
              ))}
            </div>
            <p className="m-0 mt-2 text-[rgba(28,22,40,0.5)]" style={{ lineHeight: 1.5 }}>
              Website links point at {WEB_BASE_URL}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full bg-[#38285D] text-white font-bold uppercase"
          style={{ minHeight: 44, fontSize: 11, letterSpacing: '0.14em' }}
        >
          {open ? 'Hide' : 'Dev preview'}
        </button>
      </div>
    </div>
  );
}
