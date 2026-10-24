import type {
  EnrollmentStatusView,
  InstrumentItem,
  StudentRun,
} from "@/lib/v2/types";

// Dev-only fixtures for exercising the screening/board UI without spending a
// real test account on every pass. Item names/copy were taken from the real
// D-1 instrument; only imported by the `?mock=` branches of /screening and
// /home, which are themselves compiled out of any production build.

function item(
  code: string,
  name: string,
  sectionCode: string,
  position: number,
  prompt: string,
  helpText: string,
  options: [emoji: string, label: string, description: string][],
): InstrumentItem {
  return {
    id: `mock-${code}`,
    code,
    name,
    sectionCode,
    prompt,
    helpText,
    position,
    reversed: false,
    cssrs: false,
    options: options.map(([emoji, label, description], i) => ({
      id: `mock-${code}-${i}`,
      label,
      description,
      emoji,
      score: i,
      position: i,
      safetyEffect: "NONE" as const,
    })),
  };
}

export const MOCK_RUN: StudentRun = {
  id: "mock-run-id",
  versionCode: "nsmq2026",
  kind: "D1",
  attempt: 1,
  status: "IN_PROGRESS",
  startedAt: "2026-08-21T08:00:00Z",
  submittedAt: null,
  closesAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
  questionnaire: {
    id: "mock-instrument",
    code: "NSMQ_D1",
    revision: 1,
    title: "D-1 · one day before the contest",
    sections: [
      {
        code: "ENERGY",
        parentCode: null,
        title: "Energy & Recovery",
        timeLabel: "Right now",
        position: 0,
        maxScore: 9,
      },
      {
        code: "MINDSET",
        parentCode: null,
        title: "Mindset & Pressure",
        timeLabel: "Going into the contest",
        position: 1,
        maxScore: 21,
      },
    ],
    items: [
      item(
        "BURNOUT",
        "Burnout",
        "ENERGY",
        0,
        "How mentally exhausted do you feel from preparing for NSMQ 2026?",
        "This means how tired your mind feels after all the studying — not whether you slept enough last night.",
        [
          ["🙂", "Not exhausted at all", "I still feel mentally fresh."],
          ["😐", "A little exhausted", "I feel a bit worn down some days."],
          ["😩", "Very exhausted", "Most days I feel drained from prepping."],
          ["😵", "Extremely exhausted", "I feel completely burned out."],
        ],
      ),
      item(
        "NEED_FOR_REST",
        "Need for Rest",
        "ENERGY",
        1,
        "How much do you feel you need a proper break right now?",
        "Not a nap — a real day or two off from quiz prep entirely.",
        [
          ["🙂", "Not really", "I feel fine continuing as is."],
          ["😐", "A little", "A short break would help."],
          ["😩", "A lot", "I really need to slow down soon."],
          ["😵", "Desperately", "I can't keep going like this."],
        ],
      ),
      item(
        "PERFORMANCE_WORRY",
        "Performance Worry",
        "MINDSET",
        2,
        "How much do you worry about how you'll perform in the contest?",
        "Think about the thoughts that show up when you imagine being on stage.",
        [
          ["😌", "Barely at all", "I feel calm about it."],
          ["😐", "Some worry", "It crosses my mind sometimes."],
          ["😟", "A lot of worry", "I think about it often."],
          ["😰", "Constant worry", "It's hard to think about anything else."],
        ],
      ),
      item(
        "CONFIDENCE",
        "Confidence",
        "MINDSET",
        3,
        "How confident do you feel about your team's chances?",
        "Your gut read on how prepared your team is right now.",
        [
          ["😄", "Very confident", "I feel great about our chances."],
          ["🙂", "Fairly confident", "I feel mostly good about it."],
          ["😟", "Not very confident", "I have real doubts."],
          ["😣", "Not confident at all", "I don't feel prepared."],
        ],
      ),
    ],
  },
  answers: [],
  sections: [],
  care: null,
  careAcknowledged: false,
};

export const MOCK_SUBMITTED_RUN: StudentRun = {
  ...MOCK_RUN,
  status: "SUBMITTED",
  submittedAt: "2026-08-21T08:21:03Z",
  questionnaire: null,
  answers: [
    {
      itemCode: "BURNOUT",
      optionId: "mock-BURNOUT-2",
      optionLabel: "Very exhausted",
    },
    {
      itemCode: "NEED_FOR_REST",
      optionId: "mock-NEED_FOR_REST-1",
      optionLabel: "A little",
    },
    {
      itemCode: "PERFORMANCE_WORRY",
      optionId: "mock-PERFORMANCE_WORRY-2",
      optionLabel: "A lot of worry",
    },
    {
      itemCode: "CONFIDENCE",
      optionId: "mock-CONFIDENCE-1",
      optionLabel: "Fairly confident",
    },
  ],
  sections: [
    {
      code: "GMH",
      title: "General Mental Health",
      score: 3,
      maxScore: 9,
      level: 1,
      band: "Good",
      carried: false,
    },
    {
      code: "ENERGY",
      title: "Energy & Recovery",
      score: 4,
      maxScore: 9,
      level: 2,
      band: "Average",
      carried: false,
    },
    {
      code: "MINDSET",
      title: "Mindset & Pressure",
      score: 14,
      maxScore: 21,
      level: 3,
      band: "High",
      carried: false,
    },
  ],
  care: {
    urgency: "SOON",
    message: "A counsellor will check in with you before your next contest.",
  },
};

export const MOCK_URGENT_RUN: StudentRun = {
  ...MOCK_SUBMITTED_RUN,
  sections: MOCK_SUBMITTED_RUN.sections.map((s) =>
    s.code === "GMH" ? { ...s, score: 9, level: 4, band: "Very Poor" } : s,
  ),
  care: {
    urgency: "NOW",
    message:
      "Please talk to someone now. Your school's counsellor will reach out very soon.",
  },
};

export const MOCK_STATUS: EnrollmentStatusView = {
  versionCode: "nsmq2026",
  versionLabel: "NSMQ 2026",
  open: true,
  teamId: "mock-team",
  campusId: "mock-campus",
  campusName: "Presbyterian Boys Senior High School",
  teamStatus: "ACTIVE",
  assentNeeded: false,
  assentText: null,
  assentVersion: 1,
  nextKickoff: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
  due: [
    {
      kind: "D1",
      obligationKey: "mock-d1",
      from: "2026-08-21T08:00:00Z",
      until: null,
      runId: null,
      runStatus: null,
    },
  ],
};
