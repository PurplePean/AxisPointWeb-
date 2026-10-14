import { GUTTER, PageIntro, TealButton } from '@/components/ui';

export default function ListingsPage() {
  return (
    <>
      <section className={`bg-v2-surface pb-12 pt-16 ${GUTTER}`}>
        <div className="mx-auto max-w-v2">
          <PageIntro title="Available space">
            <p className="m-0 max-w-[54ch] text-[17.5px] leading-relaxed text-v2-ink/[0.7]">
              Current retail listings, kept in step with what is on the market. Do not see the
              right fit? Tell us what you need and we will look.
            </p>
          </PageIntro>
        </div>
      </section>
      <section className={`bg-v2-surface pb-[72px] ${GUTTER}`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-7">
          {/* The Crexi embed replaces this block once Crexi confirms access. */}
          <div className="flex min-h-[380px] flex-col items-center justify-center gap-2.5 rounded-v2 border border-dashed border-[#B9AFA0] bg-v2-field-warm p-8 text-center">
            <span className="text-[28px] font-semibold tracking-[-0.03em] text-v2-purple">
              Listings are being added
            </span>
            <span className="max-w-[460px] text-[15px] leading-normal text-[#6B6070]">
              Call us or send what you are looking for, and we will send current availability
              directly.
            </span>
          </div>
          <div>
            <TealButton to="/contact?role=tenant">Tell us what you need</TealButton>
          </div>
        </div>
      </section>
    </>
  );
}
