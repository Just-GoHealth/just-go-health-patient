"use client";

import { useEffect, useState } from "react";
import { Avatar, Spinner } from "@just-gohealth/ui";
import { getRunCare } from "@/lib/v2/nsmq";
import type { RunCare, Treatment } from "@/lib/v2/types";

function TreatmentTile({ t }: { t: Treatment }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left">
      <Avatar
        src={t.photo?.thumbnailUrl ?? undefined}
        name={t.name}
        size="sm"
        className="border-line border bg-transparent"
      />
      <span className="text-sm font-semibold">{t.name}</span>
    </li>
  );
}

// The Waiting Room for a submitted run: what to try first (ranked, without
// naming the urgency), then the care for each section outcome reached.
export function WaitingRoom({ runId }: { runId: string }) {
  const [care, setCare] = useState<RunCare | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRunCare(runId)
      .then((res) => {
        if (!cancelled) setCare(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (failed) return null;
  if (!care) return <Spinner className="text-gold size-6" />;
  if (!care.first.length && !care.outcomes.length) return null;

  const byRank = (a: Treatment, b: Treatment) => a.rank - b.rank;

  return (
    <section className="w-full max-w-xl text-left">
      <h2 className="text-lg font-extrabold">Your Waiting Room</h2>
      {care.first.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {[...care.first].sort(byRank).map((t) => (
            <TreatmentTile key={t.id} t={t} />
          ))}
        </ul>
      )}
      {care.outcomes.map((o) => (
        <div key={o.outcomeId} className="mt-5">
          <p className="text-muted text-xs font-bold tracking-[0.15em] uppercase">
            {o.sectionTitle} · {o.band}
          </p>
          <p className="mt-1 text-sm">{o.label}</p>
          {o.treatments.length > 0 && (
            <ul className="mt-2 grid gap-2">
              {[...o.treatments].sort(byRank).map((t) => (
                <TreatmentTile key={t.id} t={t} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
