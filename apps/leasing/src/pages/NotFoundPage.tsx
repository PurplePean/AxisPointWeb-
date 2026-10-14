import { GUTTER, TealButton } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <section className={`bg-v2-surface py-24 ${GUTTER}`}>
      <div className="mx-auto flex max-w-v2 flex-col items-start gap-6">
        <h1 className="m-0 border-t-[3px] border-v2-purple pt-4 text-[clamp(34px,4vw,48px)] font-semibold tracking-[-0.03em]">
          Page not found
        </h1>
        <p className="m-0 max-w-[48ch] text-[17.5px] text-v2-ink/[0.7]">
          That page does not exist. Head back to the start or send us a note.
        </p>
        <TealButton to="/">Back to home</TealButton>
      </div>
    </section>
  );
}
