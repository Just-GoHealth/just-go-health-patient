import { cn } from "@just-gohealth/ui";
import type { CarePrompt as CarePromptData, Urgency } from "@/lib/v2/types";

// The student's result message, styled by `care.urgency` only. The triage
// tag (911 / NOW / ASAP) and its reason are never sent to students and must
// never be shown or inferred here.
const URGENCY_CLASS: Record<Urgency, string> = {
  NOW: "border-no/60 bg-no/15 text-txt",
  SOON: "border-gold/60 bg-gold/10 text-txt",
  ROUTINE: "border-yes/40 bg-yes/10 text-txt",
};

const URGENCY_TITLE: Record<Urgency, string> = {
  NOW: "Let's talk now",
  SOON: "We'll check in soon",
  ROUTINE: "Support is here if you want it",
};

export function CarePrompt({
  care,
  className,
}: {
  care: CarePromptData;
  className?: string;
}) {
  return (
    <div
      role={care.urgency === "NOW" ? "alert" : "status"}
      className={cn(
        "mx-auto w-full max-w-xl rounded-2xl border px-5 py-4 text-left",
        URGENCY_CLASS[care.urgency],
        className,
      )}
    >
      <p className="text-sm font-extrabold tracking-wide uppercase">
        {URGENCY_TITLE[care.urgency]}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{care.message}</p>
    </div>
  );
}
