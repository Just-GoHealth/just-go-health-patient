"use client";

import Image from "next/image";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Logo,
  OtpInput,
  cn,
} from "@just-gohealth/ui";

const CODE_INPUT_ID = "access-code-input";

// the light (cream) surface sits inside the app's dark theme, so the OTP
// boxes are recoloured here rather than taking the dark input tokens
const CODE_BOX_CLASS = {
  "": "[&_input]:border-black/15 [&_input]:bg-black/[0.03] [&_input]:text-[#1a100c] [&_input]:focus-visible:border-[#b8862e]",
  good: "[&_input]:border-[#1e8f57] [&_input]:bg-[#1e8f57]/10 [&_input]:text-[#1e8f57]",
  bad: "[&_input]:border-[#c22f3c] [&_input]:bg-[#c22f3c]/10 [&_input]:text-[#c22f3c]",
} as const;

export function CodeGateModal({
  open,
  campusName,
  length,
  code,
  codeState,
  codeMessage,
  assentText,
  disabled,
  traceId,
  onCodeChange,
  onComplete,
  onClose,
}: {
  open: boolean;
  campusName?: string;
  length: number;
  code: string;
  codeState: "" | "good" | "bad";
  codeMessage: string;
  /** The version's assent wording - joining sends `assent: true`, so it's shown here. */
  assentText?: string | null;
  /** While rate limited (the message counts down). */
  disabled?: boolean;
  /** Support reference for an unexpected failure. */
  traceId?: string;
  onCodeChange: (value: string) => void;
  onComplete: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        surface="light"
        hideClose
        aria-describedby={undefined}
        // land on the first box the moment the modal opens — no click
        // required (instead of Radix's default of the first focusable,
        // which would be the close button)
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(CODE_INPUT_ID)?.focus();
        }}
        className="flex h-[min(85vh,620px)] flex-row gap-0 overflow-hidden rounded-3xl bg-white p-0 shadow-2xl sm:max-h-none sm:max-w-4xl sm:rounded-3xl sm:p-0"
      >
        <DialogClose
          aria-label="Close"
          className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border border-black/10 text-black/50 transition-colors hover:bg-black/5"
        >
          ✕
        </DialogClose>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center sm:p-12">
          <div className="mb-8 self-start">
            <Logo
              variant="dark"
              className="h-6 w-auto shrink-0 self-start object-contain sm:h-6"
            />
          </div>

          <DialogTitle asChild>
            <h1 className="text-2xl leading-normal font-extrabold tracking-tight sm:text-3xl">
              Join{" "}
              <span className="text-[#8f6716]">
                {campusName ?? "your school"}
              </span>
            </h1>
          </DialogTitle>
          <div className="mt-3 h-px w-16 bg-gradient-to-r from-[#e8d4ad] to-[#b8862e]" />
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-black/70">
            The <strong className="text-black">{campusName}</strong> NSMQ team
            is private. To join your team, enter the access code provided by
            your school.
          </p>

          <OtpInput
            id={CODE_INPUT_ID}
            length={length}
            allowLetters
            disabled={disabled}
            aria-label="Access code"
            value={code}
            onChange={onCodeChange}
            onComplete={onComplete}
            className={cn(
              "mt-6 max-w-none justify-center gap-[1.2vw] sm:gap-2.5 [&_input]:aspect-[4/5] [&_input]:w-[clamp(26px,6.5vw,42px)] [&_input]:max-w-none [&_input]:flex-none [&_input]:font-sans [&_input]:text-[clamp(13px,3vw,18px)] [&_input]:font-bold [&_input]:uppercase",
              CODE_BOX_CLASS[codeState],
            )}
          />

          {codeMessage && (
            <p
              role={codeState === "bad" ? "alert" : "status"}
              className={`mt-3 text-sm font-medium ${
                codeState === "good" ? "text-[#1e8f57]" : "text-[#c22f3c]"
              }`}
            >
              {codeMessage}
            </p>
          )}
          {traceId && (
            <p className="mt-1 text-[10px] tracking-wide text-black/40">
              Ref: {traceId}
            </p>
          )}

          {assentText && (
            <div className="mt-6 max-h-28 max-w-sm overflow-y-auto rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-left text-[11px] leading-relaxed whitespace-pre-line text-black/60">
              <p className="mb-1 font-bold text-black/70">
                By joining, you agree to:
              </p>
              {assentText}
            </div>
          )}
        </div>

        <div className="relative hidden w-[36%] shrink-0 items-end justify-center overflow-hidden bg-gradient-to-b from-[#fdfbf6] to-[#f7f1e6] p-4 sm:flex">
          <div className="absolute top-10 right-4 left-4 rounded-2xl border border-dashed border-[#b8862e]/50 bg-[#fdfbf6] px-4 py-2.5 text-center text-[11px] font-extrabold tracking-wide text-[#8f6716] uppercase shadow-sm">
            Need your code? Contact your team.
          </div>
          <Image
            src="/images/access-code-illustration.webp"
            alt=""
            width={280}
            height={400}
            className="h-full w-full object-contain object-bottom"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
