import { useId } from 'react';
import { useMessages } from '../i18n/LocaleProvider';

/**
 * Intake field primitives, built to the approved component and state system in
 * `AxisPointFormSystem.dc.html` and the screens in `AxisPointFormFlow.dc.html`
 * (design@2026-07-30).
 *
 * All native controls. No component library is introduced to reproduce a text
 * input, a select, or a radio group.
 *
 * Approved rules encoded here: labels are persistent and sit above the field,
 * placeholders only ever carry an example, "Optional" is written next to the label
 * and everything else is required by default, errors carry a written correction in
 * magenta with a thicker border so colour is never the only signal, and every
 * target clears 44px with 52px inputs and 54px choice rows.
 */

const FIELD_BG = '#FFFCF6';
const BORDER = 'rgba(28,22,40,0.28)';
const ERROR = '#9F328C';

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 52,
  padding: '0 14px',
  background: FIELD_BG,
  borderRadius: 2,
  fontSize: 16,
  border: invalid ? `2px solid ${ERROR}` : `1px solid ${BORDER}`,
});

export function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  const t = useMessages();
  return (
    <label
      htmlFor={htmlFor}
      className="block font-semibold"
      style={{ fontSize: 14, letterSpacing: '-0.01em', marginBottom: 8 }}
    >
      {children}
      {optional && (
        /* The leading space stays in the JSX, not in the catalog: a translator should not
           have to preserve invisible leading whitespace to keep the spacing right. */
        <span className="font-medium text-[rgba(28,22,40,0.55)]"> {t.fieldOptional}</span>
      )}
    </label>
  );
}

export function FieldMessage({
  id,
  children,
  tone = 'help',
}: {
  id?: string;
  children: React.ReactNode;
  tone?: 'help' | 'error' | 'good';
}) {
  const color = tone === 'error' ? ERROR : tone === 'good' ? '#1B8DA2' : 'rgba(28,22,40,0.55)';
  return (
    <p
      id={id}
      className="flex gap-1.5 items-baseline"
      style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.45, color, fontWeight: tone === 'help' ? 400 : 600 }}
    >
      {tone === 'error' && <span aria-hidden="true">!</span>}
      <span>{children}</span>
    </p>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  optional = false,
  placeholder,
  autoComplete,
  inputMode,
  disabled = false,
  error,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'tel';
  optional?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
  disabled?: boolean;
  error?: string;
  help?: string;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  const invalid = !!error;
  return (
    <div>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={error || help ? msgId : undefined}
        style={{
          ...inputStyle(invalid),
          ...(disabled ? { opacity: 0.5, cursor: 'not-allowed', background: 'rgba(28,22,40,0.04)' } : null),
        }}
      />
      {(error || help) && (
        <FieldMessage id={msgId} tone={error ? 'error' : 'help'}>
          {error || help}
        </FieldMessage>
      )}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  optional = false,
  help,
  helpTone = 'help',
  error,
  maxWidth,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; text: string }[];
  optional?: boolean;
  help?: string;
  helpTone?: 'help' | 'good';
  /** Shown in place of the help text, and marks the control invalid, exactly like TextField. */
  error?: string;
  maxWidth?: number;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  const message = error ?? help;
  return (
    <div>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={message ? msgId : undefined}
        aria-invalid={error ? true : undefined}
        style={{ ...inputStyle(!!error), maxWidth }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
      {message && (
        <FieldMessage id={msgId} tone={error ? 'error' : helpTone}>
          {message}
        </FieldMessage>
      )}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  optional = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={placeholder}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          padding: 14,
          background: FIELD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 2,
          fontSize: 16,
          lineHeight: 1.5,
          resize: 'vertical',
        }}
      />
    </div>
  );
}

/**
 * The approved choice row: a real radio group, so arrow keys move between options
 * and the group is announced as one control. The design draws it as bordered rows
 * with a ring dot; the native input is visually replaced but never removed.
 */
export function ChoiceGroup({
  legend,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legend: string;
  /**
   * `value` is the STABLE token stored in the draft; `label` is the translated display text.
   *
   * These were one field until the localization pass, so selecting a radio stored its
   * English label and the wire mapping keyed on that. Splitting them is what lets a
   * translation change every label without changing a single submitted value.
   */
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (v: string) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="font-semibold" style={{ padding: 0, fontSize: 14, letterSpacing: '-0.01em', marginBottom: 12 }}>
        {legend}
      </legend>
      <div className={`grid gap-2.5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label
              key={o.value}
              className="cursor-pointer"
              style={{
                display: 'flex',
                alignItems: o.hint ? 'flex-start' : 'center',
                gap: 12,
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 54,
                padding: '14px 16px',
                background: on ? '#FFFFFF' : FIELD_BG,
                border: on ? '2px solid #24A5BC' : '1px solid rgba(28,22,40,0.24)',
                borderRadius: 2,
                textAlign: 'left',
              }}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                /* Visually replaced by the ring below, but kept in the accessibility
                   tree and focusable so the group behaves like a real radio group. */
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0 }}
              />
              <span
                aria-hidden="true"
                style={{
                  flex: '0 0 auto',
                  width: 14,
                  height: 14,
                  marginTop: o.hint ? 4 : 0,
                  border: on ? '4px solid #24A5BC' : '1.5px solid rgba(28,22,40,0.4)',
                  background: '#FFFFFF',
                }}
              />
              <span style={{ display: 'block', textAlign: 'left' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: o.hint ? 600 : 500,
                    letterSpacing: o.hint ? '-0.015em' : undefined,
                  }}
                >
                  {o.label}
                </span>
                {o.hint && (
                  <span
                    style={{ display: 'block', marginTop: 5, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(28,22,40,0.62)' }}
                  >
                    {o.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The approved summary alert. Focus is moved to it on a failed submit. */
export function Alert({
  children,
  innerRef,
  assertive = false,
}: {
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
  assertive?: boolean;
}) {
  return (
    <div
      ref={innerRef}
      role="alert"
      aria-live={assertive ? 'assertive' : undefined}
      tabIndex={-1}
      className="grid items-start"
      style={{
        gridTemplateColumns: '22px 1fr',
        gap: 12,
        marginBottom: 26,
        maxWidth: 560,
        padding: '16px 18px',
        background: '#FDF2F9',
        border: `1px solid ${ERROR}`,
        borderInlineStartWidth: 3,
      }}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center font-bold"
        style={{ width: 20, height: 20, border: `1.5px solid ${ERROR}`, borderRadius: '50%', fontSize: 13, color: ERROR }}
      >
        !
      </span>
      <span style={{ display: 'block', fontSize: 15, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

export const primaryButton = (loading = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  minHeight: 54,
  padding: '0 26px',
  background: '#24A5BC',
  color: '#0F1F27',
  fontSize: 15,
  fontWeight: 700,
  border: 0,
  borderRadius: 2,
  cursor: loading ? 'progress' : 'pointer',
  opacity: loading ? 0.6 : 1,
});

export const secondaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 54,
  padding: '0 22px',
  background: 'transparent',
  color: '#1C1628',
  fontSize: 15,
  fontWeight: 600,
  border: '1px solid rgba(28,22,40,0.3)',
  borderRadius: 2,
  cursor: 'pointer',
};

/** The approved success marker: teal disc, check, uppercase kicker. */
export function SuccessKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2.5" style={{ marginBottom: 24 }}>
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center font-bold"
        style={{ width: 26, height: 26, background: '#24A5BC', color: '#0F1F27', fontSize: 14, borderRadius: '50%' }}
      >
        &#10003;
      </span>
      <span
        className="font-bold uppercase text-v2-teal-support"
        style={{ fontSize: 11.5, letterSpacing: '0.14em' }}
      >
        {children}
      </span>
    </div>
  );
}
