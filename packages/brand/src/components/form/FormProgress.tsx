/**
 * Step progress indicator. Copied verbatim from
 * apps/web/src/pages/ContactPage.tsx (the `Progress` component).
 */
import React from 'react';
import type { Step } from './types';

export function FormProgress({ stepOrder, currentStep, labels }: { stepOrder: Step[]; currentStep: Step; labels: string[] }) {
  const cur = stepOrder.indexOf(currentStep);
  return (
    <div className="mb-6">
      <div className="flex items-center">
        {stepOrder.map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[0.65rem] font-semibold flex-shrink-0 z-10 transition-all ${
                i < cur  ? 'border-teal bg-teal text-white' :
                i === cur ? 'border-purple bg-[#EEEAF5] text-purple' :
                            'border-[#D4CEE8] bg-white text-hint'
              }`}
            >
              {i < cur ? '✓' : i + 1}
            </div>
            {i < stepOrder.length - 1 && (
              <div
                className="flex-1 h-[1.5px] transition-all"
                style={{ background: i < cur ? 'linear-gradient(90deg,#24a5bc,#38285d)' : '#E8E4F0' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex mt-1.5 max-md:hidden">
        {labels.map((lbl, i) => (
          <span
            key={lbl}
            className={`flex-1 text-[0.58rem] font-medium transition-colors ${
              i === cur ? 'text-purple' : i < cur ? 'text-teal' : 'text-hint'
            } ${i === 0 ? 'text-left' : i === labels.length - 1 ? 'text-right' : 'text-center'}`}
          >
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}
