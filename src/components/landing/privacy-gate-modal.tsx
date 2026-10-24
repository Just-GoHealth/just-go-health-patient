"use client";

import Image from "next/image";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Logo,
} from "@just-gohealth/ui";

const SECTIONS = [
  {
    label: "Personalization",
    body: "LOCK IN is built around you. Creating your own account allows us to understand your needs and provide information and guidance that is personal to you.",
  },
  {
    label: "Access code",
    body: "Your privacy matters, so this version of LOCK IN requires two-step authentication. After you sign in, your school will provide you with your access code.",
  },
  {
    label: "Dark",
    body: "When you click OK, LOCK IN will switch to dark mode. Think of it as a reminder that what you share here is private. Be honest with your answers. You know your body and your experience, and we know the science of mental health.",
  },
];

export function PrivacyGateModal({
  open,
  onClose,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
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
        className="flex max-h-[92vh] flex-row gap-0 overflow-hidden rounded-3xl bg-white p-0 shadow-2xl sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl sm:p-0"
      >
        <DialogClose
          aria-label="Close"
          className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border border-black/10 text-black/50 transition-colors hover:bg-black/5"
        >
          ✕
        </DialogClose>

        <div className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-9">
          <div className="mb-4">
            <Logo
              variant="dark"
              className="h-6 w-auto shrink-0 self-start object-contain sm:h-6"
            />
          </div>

          <DialogTitle asChild>
            <h1 className="text-2xl leading-normal font-extrabold tracking-tight sm:text-3xl">
              Your Privacy Comes <span className="text-[#8f6716]">First</span>
            </h1>
          </DialogTitle>
          <div className="mt-3 h-px w-16 bg-gradient-to-r from-[#e8d4ad] to-[#b8862e]" />

          <div className="mt-3 flex flex-col divide-y divide-black/10">
            {SECTIONS.map((s) => (
              <div key={s.label} className="py-2.5 text-center first:pt-0">
                <div className="text-xs font-bold tracking-[0.2em] text-[#8f6716] uppercase">
                  {s.label}
                </div>
                <p className="mt-1.5 text-sm leading-snug text-black/70">
                  {s.body}
                </p>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            onClick={onContinue}
            className="mx-auto mt-5 flex bg-[#4a201c] px-6 font-semibold text-[#f6e7c4] hover:bg-[#5a2c26]"
          >
            Okay, let&apos;s go 🚀
          </Button>
        </div>

        <div className="hidden w-[36%] shrink-0 items-end justify-center overflow-hidden bg-gradient-to-b from-[#fdfbf6] to-[#f7f1e6] p-4 sm:flex">
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
