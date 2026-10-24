import { describe, expect, it } from "vitest";
import { NEXT_ROUTES, needsTeam, nextDestination } from "./next-route";
import type { Enrollment, PatientNext } from "./types";

const enrollment = (over: Partial<Enrollment> = {}): Enrollment => ({
  versionCode: "nsmq26",
  versionLabel: "NSMQ 2026",
  status: "ACTIVE",
  selectedCampusId: null,
  teamId: null,
  joinable: true,
  ...over,
});

describe("me.next routing table", () => {
  it.each<[PatientNext, ReturnType<typeof nextDestination>]>([
    ["PHOTO", { page: "/onboard", step: "photo" }],
    ["SCHOOL_TYPE", { page: "/onboard", step: "schoolType" }],
    ["PROGRAMME", { page: "/onboard", step: "programme" }],
    ["GRADE", { page: "/onboard", step: "grade" }],
    ["FINISH", { page: "/onboard", step: "finish" }],
    ["HOME", { page: "/home" }],
  ])("routes %s", (next, dest) => {
    expect(nextDestination(next)).toEqual(dest);
    expect(NEXT_ROUTES[next]).toEqual(dest);
  });

  it("sends an NSMQ student without a team to the team picker after the photo", () => {
    const e = enrollment();
    expect(nextDestination("SCHOOL_TYPE", e)).toEqual({
      page: "/onboard",
      step: "nsmqCampus",
    });
    expect(nextDestination("HOME", e)).toEqual({
      page: "/onboard",
      step: "nsmqCampus",
    });
    expect(nextDestination("PHOTO", e)).toEqual({
      page: "/onboard",
      step: "photo",
    });
  });

  it("routes normally once on a team, or when the version isn't joinable", () => {
    expect(nextDestination("HOME", enrollment({ teamId: "t-1" }))).toEqual({
      page: "/home",
    });
    expect(
      nextDestination("SCHOOL_TYPE", enrollment({ joinable: false })),
    ).toEqual({ page: "/onboard", step: "schoolType" });
  });

  it("falls back to home for an unknown next value", () => {
    expect(nextDestination("LATER" as PatientNext)).toEqual({ page: "/home" });
  });

  it("needsTeam only for an enrollment without a team", () => {
    expect(needsTeam(null)).toBe(false);
    expect(needsTeam(enrollment())).toBe(true);
    expect(needsTeam(enrollment({ teamId: "t-1" }))).toBe(false);
  });
});
