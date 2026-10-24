import type { DomeItem, DomeSection } from "@just-gohealth/ui";
import type { Instrument, RunAnswer, RunLevel, RunSection } from "./types";

/**
 * v2 section level (0 best → 4 worst) → the DomeBoard's pill colour family.
 * PROVISIONAL: the colour per level still needs design sign-off. Level 4 is
 * "red", not "emg": the emergency treatment came from the v1 triage tag,
 * which students must never see.
 */
export const LEVEL_FAMILY: Record<RunLevel, DomeSection["fam"]> = {
  0: "green",
  1: "green",
  2: "gold",
  3: "red",
  4: "red",
};

/**
 * Maps a submitted run's sections onto the DomeBoard's section shape. Pass the
 * questionnaire (only present while the run was IN_PROGRESS) to also list each
 * answer under its section and show the time-frame caption.
 */
export function toDomeSections(
  sections: RunSection[],
  detail?: { questionnaire: Instrument | null; answers: RunAnswer[] },
): DomeSection[] {
  const questionnaire = detail?.questionnaire ?? null;
  return sections.map((s) => {
    const meta = questionnaire?.sections.find((qs) => qs.code === s.code);
    const items: DomeItem[] | undefined = questionnaire
      ? questionnaire.items
          .filter((it) => it.sectionCode === s.code && !it.cssrs)
          .sort((a, b) => a.position - b.position)
          .flatMap((it) => {
            const a = detail?.answers.find((x) => x.itemCode === it.code);
            return a
              ? [
                  {
                    itemCode: it.code,
                    name: it.name ?? it.code,
                    label: a.optionLabel,
                  },
                ]
              : [];
          })
      : undefined;
    return {
      key: s.code,
      title: s.title,
      time: meta?.timeLabel ?? undefined,
      score: s.score ?? undefined,
      max: s.maxScore ?? undefined,
      band: s.band,
      fam: LEVEL_FAMILY[s.level] ?? "gold",
      items,
    };
  });
}
