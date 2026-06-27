/**
 * Referral share landing page — /share/:code
 *
 * Mobile: immediately invokes the native Web Share sheet with the referral
 * link, then forwards to the contact form. Desktop (no navigator.share):
 * renders a simple copy-the-link card.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

function SharePage() {
  const { code } = useParams<{ code: string }>();
  const referralUrl = `https://axispoint.llc/contact?ref=${code ?? ''}`;
  const contactUrl = `https://axispoint.llc/contact?ref=${code ?? ''}`;

  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const firedRef = useRef(false);

  useEffect(() => {
    if (!code || firedRef.current) return;
    firedRef.current = true;

    if (canShare) {
      navigator
        .share({
          title: 'AxisPoint Partners',
          text: 'Commercial real estate, done right.',
          url: referralUrl,
        })
        .catch(() => { /* user dismissed or share failed — fall through */ })
        .finally(() => {
          window.location.href = contactUrl;
        });
    }
    // Desktop: no auto-share; render the fallback UI below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5FB] px-6">
      <div className="w-full max-w-[420px] rounded-[16px] border border-border bg-white p-8 text-center shadow-card">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo-mark.png" width={28} height={28} alt="AxisPoint" />
          <span className="text-[18px] font-medium">
            <span style={{ color: '#38285D' }}>Axis</span>
            <span style={{ color: '#24A5BC' }}>Point</span>
          </span>
        </div>

        {canShare ? (
          <p className="text-[0.9rem] text-sub leading-relaxed">Opening your share sheet…</p>
        ) : (
          <>
            <h1 className="font-serif font-semibold text-ink text-[1.3rem] mb-2">Share your referral link</h1>
            <p className="text-[0.82rem] text-sub leading-relaxed mb-5">
              Send this link to anyone who should talk to us. We will make sure you get credit.
            </p>

            <div className="flex items-center gap-2 rounded-[10px] border border-border bg-[#F7F5FB] px-3 py-2.5 mb-3 text-left">
              <span className="flex-1 text-[0.75rem] text-ink truncate font-mono">{referralUrl}</span>
            </div>

            <button
              type="button"
              onClick={copy}
              className="w-full py-3 rounded-[10px] border-none bg-teal text-white text-[0.85rem] font-semibold cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] mb-4"
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>

            <p className="text-[0.78rem] text-sub">
              Or visit:{' '}
              <a href={contactUrl} className="text-teal hover:underline">
                the contact form
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SharePage;
