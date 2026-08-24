"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VERSIONS_SEEN_KEY } from "@/lib/constants";
import "./versions.css";

type VersionTile = {
  id: string;
  label: string;
  theme: "purple" | "green" | "ink";
  sub: string;
  subs: [string, string][];
  locked: boolean;
};

const VERSIONS: VersionTile[] = [
  {
    id: "nsmq2026",
    label: "NSMQ 2026",
    theme: "purple",
    sub: "Compete at your best while taking care of your mind along the way.",
    subs: [
      ["Before every contest", "1 day"],
      ["Before every contest", "3 hours"],
      ["Of care after your last contest", "72 hours"],
    ],
    locked: false,
  },
  {
    id: "uglaw",
    label: "UG Law Finals",
    theme: "ink",
    sub: "Sit your finals steady, with your head kept as carefully as your notes.",
    subs: [
      ["Before the first paper", "14 days"],
      ["Before every paper", "12 hours"],
      ["Of care after your last paper", "7 days"],
    ],
    locked: true,
  },
  {
    id: "bece2027",
    label: "BECE 2027",
    theme: "green",
    sub: "Walk into your first big exam calm, prepared and properly looked after.",
    subs: [
      ["Before the first paper", "30 days"],
      ["Before every paper", "6 hours"],
      ["Of care after your last paper", "14 days"],
    ],
    locked: true,
  },
];

function nameCls(name: string): string {
  const words = name.trim().split(/\s+/).length;
  return words >= 3 ? " l3" : words === 2 ? " l2" : "";
}

export default function VersionsPage() {
  const router = useRouter();
  const [pickedId, setPickedId] = useState<string | null>(null);

  function pick(v: VersionTile) {
    if (v.locked || pickedId) return;
    setPickedId(v.id);
    try {
      localStorage.setItem(VERSIONS_SEEN_KEY, "1");
    } catch {
      // ignore unavailable storage (e.g. private browsing)
    }
    // a beat for the picked glow to register before the page navigates away
    setTimeout(() => router.push("/"), 550);
  }

  return (
    <div className="vs-page">
      <div className="vs-split">
        <aside className="vs-left">
          <figure className="vs-photo">
            <Image
              src="/images/manpointing.webp"
              alt=""
              fill
              sizes="30vw"
              priority
            />
          </figure>
        </aside>

        <span className="vs-invite">By invitation only</span>

        <section className="vs-right">
          <div className="vs-mark">
            <span className="bk-logo" aria-hidden="true" />
          </div>

          <header className="vs-head">
            <h1 className="vs-h1">
              Welcome to <em>JustGo Health</em>
            </h1>
            <p className="vs-lede">
              You&rsquo;ve been invited to experience <b>LOCK IN</b>. Choose
              the version of LOCK IN that&rsquo;s right for you. JustGo
              Health is currently available by invitation only.
            </p>
          </header>

          <div className="vs-row">
            {VERSIONS.map((v, i) => (
              <div
                key={v.id}
                className={`tile-unit t-${v.theme}${v.locked ? " locked" : ""}${
                  pickedId === v.id ? " picked" : ""
                }${pickedId && pickedId !== v.id ? " dimmed" : ""}`}
                style={{ "--dd": `${i * 0.3}s` } as React.CSSProperties}
                role={v.locked ? undefined : "button"}
                tabIndex={v.locked ? undefined : 0}
                onClick={() => pick(v)}
                onKeyDown={(e) => {
                  if (!v.locked && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    pick(v);
                  }
                }}
              >
                <div className="dome">
                  {pickedId === v.id && (
                    <span className="tile-spinner" aria-hidden="true" />
                  )}
                  <div className={`d-name${nameCls(v.label)}`}>{v.label}</div>
                  <div className="d-sub">{v.sub}</div>
                </div>
                <div className="dome-subs">
                  {v.subs.map(([label, outcome], si) => (
                    <div
                      key={si}
                      className="ss"
                      style={
                        {
                          "--sd": `${i * 0.3 + 0.32 + si * 0.07}s`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="ss-box">
                        <svg viewBox="0 0 24 24">
                          <path d="M5 12.4 9.6 17 19 7.2" />
                        </svg>
                      </span>
                      <span className="ss-label">{label}</span>
                      <span className="ss-out">({outcome})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
