import { describe, expect, it } from "vitest";
import { LEVEL_FAMILY, toDomeSections } from "./dome";
import type { Instrument, RunSection } from "./types";

const section = (over: Partial<RunSection> = {}): RunSection => ({
  code: "GMH",
  title: "General Mental Health",
  score: 3,
  maxScore: 9,
  level: 1,
  band: "Good",
  carried: false,
  ...over,
});

describe("run sections → dome sections", () => {
  it("maps the fields DomeBoard reads", () => {
    expect(toDomeSections([section()])).toEqual([
      {
        key: "GMH",
        title: "General Mental Health",
        time: undefined,
        score: 3,
        max: 9,
        band: "Good",
        fam: "green",
        items: undefined,
      },
    ]);
  });

  it("colours by level and never uses the emergency family", () => {
    const fams = ([0, 1, 2, 3, 4] as const).map(
      (level) => toDomeSections([section({ level })])[0].fam,
    );
    expect(fams).toEqual(["green", "green", "gold", "red", "red"]);
    expect(Object.values(LEVEL_FAMILY)).not.toContain("emg");
  });

  it("turns null scores into undefined", () => {
    const [dome] = toDomeSections([section({ score: null, maxScore: null })]);
    expect(dome.score).toBeUndefined();
    expect(dome.max).toBeUndefined();
  });

  it("lists answers per section and the time label when the questionnaire is known", () => {
    const questionnaire = {
      sections: [
        {
          code: "GMH",
          parentCode: null,
          title: "General Mental Health",
          timeLabel: "Over the last two weeks",
          position: 0,
          maxScore: 9,
        },
      ],
      items: [
        {
          code: "SADNESS",
          name: "Sadness",
          sectionCode: "GMH",
          position: 1,
          cssrs: false,
        },
        {
          code: "LOSS",
          name: null,
          sectionCode: "GMH",
          position: 0,
          cssrs: false,
        },
        {
          code: "SAFE_1",
          name: "Safety",
          sectionCode: "GMH",
          position: 2,
          cssrs: true,
        },
        {
          code: "BURNOUT",
          name: "Burnout",
          sectionCode: "ENERGY",
          position: 0,
          cssrs: false,
        },
      ],
    } as unknown as Instrument;
    const answers = [
      { itemCode: "SADNESS", optionId: "o1", optionLabel: "Okay" },
      { itemCode: "LOSS", optionId: "o2", optionLabel: "A few days" },
      { itemCode: "SAFE_1", optionId: "o3", optionLabel: "No" },
    ];

    const [dome] = toDomeSections([section()], { questionnaire, answers });

    expect(dome.time).toBe("Over the last two weeks");
    // in position order, safety (C-SSRS) items left out
    expect(dome.items).toEqual([
      { itemCode: "LOSS", name: "LOSS", label: "A few days" },
      { itemCode: "SADNESS", name: "Sadness", label: "Okay" },
    ]);
  });
});
