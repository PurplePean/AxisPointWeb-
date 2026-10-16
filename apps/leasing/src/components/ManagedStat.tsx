import { managedStatText } from '@/content/proof';

/** Renders the managed square footage stat, or nothing when proof is hidden. */
export default function ManagedStat({ className = '' }: { className?: string }) {
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
