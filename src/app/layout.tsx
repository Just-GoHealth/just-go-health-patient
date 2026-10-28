import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Toaster } from "@just-gohealth/ui";
import "./globals.css";
import { ApiMocking } from "@/components/shared/api-mocking";
import { ReferralCapture } from "@/components/shared/referral-capture";
import { SessionConfig } from "@/components/shared/session-config";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JustGo Health — Lock In",
  description: "Set your battery, get your plan, lock in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ApiMocking>
          <ReferralCapture />
          <SessionConfig />
          {children}
          <Toaster />
        </ApiMocking>
      </body>
    </html>
  );
}
