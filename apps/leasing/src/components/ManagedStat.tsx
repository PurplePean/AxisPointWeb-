import { managedStatParts, managedStatText } from '@/content/proof';
import { BigStat } from '@/components/ui';

/**
 * Renders the managed square footage stat, or nothing when proof is hidden.
 * `large` shows the big-figure treatment used under page heroes.
 */
export default function ManagedStat({
  className = '',
  large = false,
}: {
  className?: string;
  large?: boolean;
}) {
  if (large) {
    const parts = managedStatParts();
    if (parts === null) return null;
    return (
      <div className={className}>
        <BigStat value={parts.value} label={parts.label} />
      </div>
    );
  }
  const text = managedStatText();
  if (text === null) return null;
  return (
    <p
      className={`m-0 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-v2-ink ${className}`}
    >
      {text}
    </p>
  );
}
