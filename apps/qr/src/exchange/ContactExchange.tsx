import { useId } from 'react';

import { useExchange } from './useExchange';
import { SAVE_ACTION_LABEL } from '../useSaveContact';
import {
  CONTACT_CATEGORIES,
  COPY,
  categoryLabel,
  summaryTitle,
  type ExchangeField,
} from './model';

/**
 * The Contact Exchange screen, built from `AxisPoint QR Contact Exchange.dc.html`
 * (design@2026-08-01): §x2 full screen not a sheet, §x3 form states, §x4 success,
 * §x5 failure and recovery, §x6 responsive widths, §x7 validation, §x8 accessibility,
 * §x10 the exact visible copy.
 *
 * §x4's per-subject success variants are gone with the owner-directed single-page collapse
 * of 2026-08-17. There is one page and therefore one subject, so the copy is constant and
 * this component takes no subject prop and no profile key.
 *
 * ONE SCREEN, NOT A WIZARD. No steps, no progress indicator, no next button. Everything
 * required is visible before the visitor commits to anything.
 *
 * The duplicate case is deliberately absent (§x4): if the backend flags a possible match,
 * the visitor sees the ordinary success screen word for word. Duplicate review is internal
 * work done later by a partner, and this component must render nothing conditional on it.
 * The client never learns a match occurred, so there is nothing here to get wrong.
 */

const INK = '#1C1628';
const FIELD_BG = '#FFFFFF';
const BORDER = 'rgba(28,22,40,0.28)';
/** §x8: the darker magenta, for 5.6:1 on the warm field. The brand magenta is too light. */
const ERROR = '#8C2A7A';
const TEAL = '#24A5BC';
const FOCUS = '#38285D';

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 48,
  padding: '0 12px',
  background: FIELD_BG,
  border: `1px solid ${invalid ? ERROR : BORDER}`,
  borderRadius: 2,
  // §x8: 15px minimum so iOS does not zoom the page on focus.
  fontSize: 15,
  color: INK,
});

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block font-semibold" style={{ fontSize: 14, marginBottom: 7, color: INK }}>
      {children}
      {/* §x8: "Optional" is part of the label text, never a placeholder or a tooltip. */}
      {optional && <span className="font-medium" style={{ color: 'rgba(28,22,40,0.55)' }}> Optional</span>}
    </label>
  );
}

function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="font-semibold" style={{ margin: '7px 0 0', fontSize: 13.5, lineHeight: 1.45, color: ERROR }}>
      {children}
    </p>
  );
}

export function ContactExchange({
  onClose,
  onSaveContact,
}: {
  onClose: () => void;
  /** The approved success primary action: the card's own Save action. */
  onSaveContact: () => void;
}) {
  const m = useExchange();
  const ids = useId();
  const fid = (name: string) => `${ids}-${name}`;

  const sending = m.sendState === 'sending';
  const failed = m.sendState === 'failed';
  // A permanent rejection or an unconfigured build. Retrying cannot help, so it is not offered.
  const cannotSend = m.sendState === 'blocked' || m.sendState === 'unavailable';

  /* ── Success ─────────────────────────────────────────────────────────────── */

  if (m.screen === 'success') {
    return (
      <Shell onClose={onClose} headingRef={m.headingRef} title={COPY.heading}>
        <div style={{ paddingTop: 8 }}>
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center font-bold"
            style={{ width: 30, height: 30, borderRadius: '50%', background: TEAL, color: '#0F1F27', fontSize: 15, marginBottom: 18 }}
          >
            &#10003;
          </span>
          <h3
            ref={m.successRef}
            role="status"
            tabIndex={-1}
            className="font-bold"
            style={{ margin: '0 0 12px', fontSize: 21, lineHeight: 1.25, letterSpacing: '-0.02em', color: INK }}
          >
            {COPY.successHeading}
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.55, color: 'rgba(28,22,40,0.72)' }}>
            {COPY.successBody}
          </p>

          <button type="button" onClick={onSaveContact} style={primaryButton()} className="w-full">
            {SAVE_ACTION_LABEL}
          </button>

          <p style={{ margin: '18px 0 0', fontSize: 13, lineHeight: 1.5, color: 'rgba(28,22,40,0.55)' }}>
            {COPY.successFoot}
          </p>
        </div>
      </Shell>
    );
  }

  /* ── Form ────────────────────────────────────────────────────────────────── */

  return (
    <Shell onClose={onClose} headingRef={m.headingRef} title={COPY.heading}>
      <p style={{ margin: '0 0 22px', fontSize: 15, lineHeight: 1.55, color: 'rgba(28,22,40,0.72)' }}>
        {COPY.supporting}
      </p>

      {/* §x5: the failure banner. Values survive, and the submit label becomes Try again. */}
      {failed && (
        <div role="alert" style={bannerStyle} tabIndex={-1}>
          <strong style={{ display: 'block', fontSize: 15, marginBottom: 5 }}>{COPY.failureHeading}</strong>
          <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>{COPY.failureBody}</span>
        </div>
      )}

      {cannotSend && (
        <div role="alert" style={bannerStyle} tabIndex={-1}>
          <strong style={{ display: 'block', fontSize: 15, marginBottom: 5 }}>{COPY.failureHeading}</strong>
          <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>
            Nothing was lost and nothing was sent. Use the Email action on the card to reach
            AxisPoint directly.
          </span>
        </div>
      )}

      {/* §x7: the summary sits above the first field, names problems in field order, and
          takes focus on a failed submit. Each line jumps to its field. */}
      {m.summary.length > 0 && (
        <div ref={m.summaryRef} role="alert" tabIndex={-1} style={summaryStyle}>
          <strong style={{ display: 'block', fontSize: 14.5, marginBottom: 8 }}>
            {summaryTitle(m.summary.length)}
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {m.summary.map((item) => (
              <li key={item.field} style={{ fontSize: 14, lineHeight: 1.5 }}>
                {/*
                  A summary line is a real jump target, so it clears 44px like every other
                  control (§x8). As inline text it measured 21px, which is a touch target
                  nobody can reliably hit. The height comes from padding rather than a fixed
                  box so a message that wraps to two lines still grows instead of clipping.
                */}
                <button
                  type="button"
                  onClick={() => m.focusField(item.field)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 44,
                    padding: '4px 0',
                    background: 'none',
                    border: 0,
                    color: ERROR,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  {item.label}: {item.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid" style={{ gap: 18 }}>
        <Field
          id={fid('name')}
          label="Full name"
          value={m.draft.fullName}
          onChange={(v) => m.set('fullName', v)}
          onBlur={() => m.blur('fullName')}
          register={(el) => m.registerField('fullName', el)}
          error={m.errors.fullName}
          autoComplete="name"
          placeholder="Your name"
          required
          readOnly={sending}
        />

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="font-semibold" style={{ padding: 0, fontSize: 14, marginBottom: 3, color: INK }}>
            How to reach you
          </legend>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(28,22,40,0.6)' }}>
            Email or phone. One is enough.
          </p>
          <div className="grid" style={{ gap: 14 }}>
            <Field
              id={fid('email')}
              label="Email"
              value={m.draft.email}
              onChange={(v) => m.set('email', v)}
              onBlur={() => m.blur('email')}
              register={(el) => m.registerField('email', el)}
              error={m.errors.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              readOnly={sending}
            />
            <Field
              id={fid('phone')}
              label="Phone"
              value={m.draft.phone}
              onChange={(v) => m.set('phone', v)}
              onBlur={() => m.blur('phone')}
              register={(el) => m.registerField('phone', el)}
              error={m.errors.phone}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              readOnly={sending}
            />
          </div>
        </fieldset>

        {/*
          §x8 category control, implementation contract.

          The approved treatment is a button plus listbox, and the board BINDS the
          implementation to a proven accessible primitive rather than bespoke keyboard and
          screen reader logic, naming a native select as an acceptable fallback. This repo
          introduces no component library, so the native select is the proven primitive
          here: arrow keys, type-ahead, Escape, the mobile picker, and every assistive
          technology behaviour come from the platform rather than from code written for this
          page.

          The board's only objection to the native control was iOS truncating the longest
          label at 320px. That is answered directly below: the full selected label is echoed
          as wrapping text under the control, so nothing is ever hidden by truncation.
        */}
        <div>
          <Label htmlFor={fid('cat')}>Which best describes you?</Label>
          <select
            id={fid('cat')}
            ref={(el) => m.registerField('category', el)}
            value={m.draft.category}
            onChange={(e) => m.set('category', e.target.value as typeof m.draft.category)}
            onBlur={() => m.blur('category')}
            disabled={sending}
            required
            aria-required="true"
            aria-invalid={m.errors.category ? true : undefined}
            aria-describedby={m.errors.category ? fid('cat-err') : fid('cat-echo')}
            style={{ ...inputStyle(!!m.errors.category), appearance: 'auto' }}
          >
            <option value="">Select one</option>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* The truncation answer. Present only once a choice exists, so it never reads as
              instructions the visitor has to act on. */}
          {m.draft.category && !m.errors.category && (
            <p id={fid('cat-echo')} style={{ margin: '7px 0 0', fontSize: 13.5, lineHeight: 1.45, color: 'rgba(28,22,40,0.7)' }}>
              {categoryLabel(m.draft.category)}
            </p>
          )}
          {m.errors.category && <ErrorText id={fid('cat-err')}>{m.errors.category}</ErrorText>}
        </div>

        {/* §x6: above 834px the two optional pairs sit side by side. */}
        <div className="grid gap-[18px] min-[834px]:grid-cols-2">
          <Field
            id={fid('company')}
            label="Company or organization"
            value={m.draft.company}
            onChange={(v) => m.set('company', v)}
            autoComplete="organization"
            optional
            readOnly={sending}
          />
          <Field
            id={fid('role')}
            label="Role or title"
            value={m.draft.roleOrTitle}
            onChange={(v) => m.set('roleOrTitle', v)}
            autoComplete="organization-title"
            optional
            readOnly={sending}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={failed ? m.retry : m.submit}
            disabled={sending}
            aria-busy={sending || undefined}
            className="w-full"
            style={primaryButton(sending)}
          >
            {sending ? COPY.submitSending : failed ? COPY.submitRetry : COPY.submit}
          </button>
          <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.5, color: 'rgba(28,22,40,0.55)' }}>
            {COPY.foot}
          </p>
        </div>
      </div>
    </Shell>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

const bannerStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: '14px 16px',
  background: '#FDF2F9',
  border: `1px solid ${ERROR}`,
  borderInlineStartWidth: 3,
  color: INK,
};

const summaryStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: '14px 16px',
  background: '#FDF2F9',
  border: `1px solid ${ERROR}`,
  borderInlineStartWidth: 3,
  color: ERROR,
};

function primaryButton(sending = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    padding: '0 22px',
    border: 0,
    borderRadius: 2,
    fontSize: 16,
    fontWeight: 700,
    background: sending ? '#1B8DA2' : TEAL,
    color: sending ? '#FFFFFF' : '#0F1F27',
    cursor: sending ? 'default' : 'pointer',
  };
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  register,
  error,
  type = 'text',
  optional,
  required,
  placeholder,
  autoComplete,
  inputMode,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  register?: (el: HTMLElement | null) => void;
  error?: string;
  type?: 'text' | 'email' | 'tel';
  optional?: boolean;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'tel' | 'text';
  readOnly?: boolean;
}) {
  const errId = `${id}-err`;
  return (
    <div>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <input
        id={id}
        ref={(el) => register?.(el)}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        /* §x5: read-only while sending rather than disabled, so the values stay
           announceable to a screen reader instead of dropping out of the tree. */
        readOnly={readOnly}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        style={inputStyle(!!error)}
      />
      {error && <ErrorText id={errId}>{error}</ErrorText>}
    </div>
  );
}

/**
 * The approved full screen (§x2): keeps the AxisPoint frame, holds a 480px measure above
 * 834px, and respects the safe-area insets so the submit control clears the home indicator.
 */
function Shell({
  children,
  onClose,
  headingRef,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
  title: string;
}) {
  return (
    <div
      data-exchange=""
      style={{
        minHeight: '100dvh',
        background: '#F6F2EA',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>
        <div className="flex items-center justify-between" style={{ minHeight: 56 }}>
          <span className="font-bold" style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(28,22,40,0.6)' }}>
            AxisPoint
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center"
            style={{ minHeight: 44, minWidth: 44, background: 'none', border: 0, fontSize: 15, color: INK, cursor: 'pointer' }}
          >
            {COPY.close}
          </button>
        </div>

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-bold"
          style={{ margin: '10px 0 14px', fontSize: 25, lineHeight: 1.2, letterSpacing: '-0.02em', color: INK }}
        >
          {title}
        </h2>

        {children}
      </div>

      {/* §x8: the approved focus ring, applied to every control on this surface at once. */}
      <style>{`
        [data-exchange] :is(input, select, button):focus-visible {
          outline: 3px solid ${FOCUS};
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}

export type { ExchangeField };
