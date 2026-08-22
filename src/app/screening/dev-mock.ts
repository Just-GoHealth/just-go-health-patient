import type { ScreeningBoard, ScreeningRun } from "@/lib/api";

// Dev-only fixtures for exercising the screening/board UI without spending a
// real test account on every pass. Item names/copy where taken from the real
// T-24 instrument; never imported outside screening/page.tsx's mock branch,
// and that branch is itself compiled out of any production build.

export const MOCK_SCREENING_RUN: ScreeningRun = {
  screeningId: "mock-screening-id",
  window: "PRE_LONG",
  label: "T-24",
  heading: "24 hours before the contest",
  status: "IN_PROGRESS",
  answered: 0,
  total: 5,
  items: [
    {
      itemCode: "BURNOUT",
      name: "Burnout",
      shortName: "Burnout",
      section: "Energy",
      question: "How mentally exhausted do you feel from preparing for NSMQ 2026?",
      help: "This means how tired your mind feels after all the studying — not whether you slept enough last night.",
      cssrs: false,
      options: [
        { index: 0, emoji: "🙂", label: "Not exhausted at all", sub: "I still feel mentally fresh." },
        { index: 1, emoji: "😐", label: "A little exhausted", sub: "I feel a bit worn down some days." },
        { index: 2, emoji: "😩", label: "Very exhausted", sub: "Most days I feel drained from prepping." },
        { index: 3, emoji: "😵", label: "Extremely exhausted", sub: "I feel completely burned out." },
      ],
    },
    {
      itemCode: "NEED_FOR_REST",
      name: "Need for Rest",
      shortName: "Need for Rest",
      section: "Energy",
      question: "How much do you feel you need a proper break right now?",
      help: "Not a nap — a real day or two off from quiz prep entirely.",
      cssrs: false,
      options: [
        { index: 0, emoji: "🙂", label: "Not really", sub: "I feel fine continuing as is." },
        { index: 1, emoji: "😐", label: "A little", sub: "A short break would help." },
        { index: 2, emoji: "😩", label: "A lot", sub: "I really need to slow down soon." },
        { index: 3, emoji: "😵", label: "Desperately", sub: "I can't keep going like this." },
      ],
    },
    {
      itemCode: "PERFORMANCE_WORRY",
      name: "Performance Worry",
      shortName: "Performa...",
      section: "Mindset",
      question: "How much do you worry about how you'll perform in the contest?",
      help: "Think about the thoughts that show up when you imagine being on stage.",
      cssrs: false,
      options: [
        { index: 0, emoji: "😌", label: "Barely at all", sub: "I feel calm about it." },
        { index: 1, emoji: "😐", label: "Some worry", sub: "It crosses my mind sometimes." },
        { index: 2, emoji: "😟", label: "A lot of worry", sub: "I think about it often." },
        { index: 3, emoji: "😰", label: "Constant worry", sub: "It's hard to think about anything else." },
      ],
    },
    {
      itemCode: "DIFFICULTY_CONCENTRATING",
      name: "Difficulty Concentrating",
      shortName: "Difficulty ...",
      section: "Mindset",
      question: "How hard has it been to concentrate while studying?",
      help: "Losing your place, re-reading the same line, or drifting off mid-topic.",
      cssrs: false,
      options: [
        { index: 0, emoji: "🙂", label: "Not hard at all", sub: "I focus fine." },
        { index: 1, emoji: "😐", label: "A little hard", sub: "I lose focus sometimes." },
        { index: 2, emoji: "😟", label: "Quite hard", sub: "I struggle to stay on task often." },
        { index: 3, emoji: "😵", label: "Very hard", sub: "I can barely concentrate at all." },
      ],
    },
    {
      itemCode: "CONFIDENCE",
      name: "Confidence",
      shortName: "Confidence",
      section: "Mindset",
      question: "How confident do you feel about your team's chances?",
      help: "Your gut read on how prepared your team is right now.",
      cssrs: false,
      options: [
        { index: 0, emoji: "😄", label: "Very confident", sub: "I feel great about our chances." },
        { index: 1, emoji: "🙂", label: "Fairly confident", sub: "I feel mostly good about it." },
        { index: 2, emoji: "😟", label: "Not very confident", sub: "I have real doubts." },
        { index: 3, emoji: "😣", label: "Not confident at all", sub: "I don't feel prepared." },
      ],
    },
  ],
  answeredIndexes: [],
};

export const MOCK_SCREENING_BOARD: ScreeningBoard = {
  screeningId: "mock-screening-id",
  run: "t24",
  label: "T-24",
  head: "24 Hours Before Contest",
  at: "2026-08-21T08:21:03",
  school: "Presbyterian Boys Senior High School",
  emergency: false,
  careAcknowledged: false,
  sections: [
    {
      key: "gmh",
      title: "General Mental Health",
      time: "Over the last two weeks",
      score: 3,
      max: 9,
      band: "Good",
      fam: "green",
      emergency: false,
      items: [
        { itemCode: "LOSS_OF_INTEREST", name: "Loss of Interest", label: "A few days", severity: "mild" },
        { itemCode: "SADNESS", name: "Sadness", label: "I have generally felt okay.", severity: "mild" },
        { itemCode: "LONELINESS", name: "Loneliness", label: "Cut off on a few days", severity: "mod" },
      ],
    },
    {
      key: "energy",
      title: "Energy & Recovery",
      time: "Right now",
      score: 4,
      max: 9,
      band: "Average",
      fam: "gold",
      emergency: false,
      items: [
        { itemCode: "BURNOUT", name: "Burnout", label: "Very exhausted", severity: "mod" },
        { itemCode: "NEED_FOR_REST", name: "Need for Rest", label: "A little", severity: "mild" },
      ],
    },
    {
      key: "mindset",
      title: "Mindset & Pressure",
      time: "Going into the contest",
      score: 8,
      max: 21,
      band: "Moderate",
      fam: "gold",
      emergency: false,
      items: [
        { itemCode: "PERFORMANCE_WORRY", name: "Performance Worry", label: "A lot of worry", severity: "mod" },
        { itemCode: "DIFFICULTY_CONCENTRATING", name: "Difficulty Concentrating", label: "Quite hard", severity: "mod" },
        { itemCode: "CONFIDENCE", name: "Confidence", label: "Fairly confident", severity: "mild" },
      ],
    },
  ],
};

export const MOCK_SCREENING_BOARD_EMERGENCY: ScreeningBoard = {
  ...MOCK_SCREENING_BOARD,
  emergency: true,
  sections: MOCK_SCREENING_BOARD.sections?.map((s) =>
    s.key === "gmh" ? { ...s, band: "Emergency", fam: "emg", emergency: true } : s,
  ),
};
