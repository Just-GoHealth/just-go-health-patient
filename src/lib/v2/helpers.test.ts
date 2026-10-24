import { describe, expect, it } from "vitest";
import {
  asApiError,
  formLevelError,
  isSignedOut,
  isUnexpected,
  localError,
} from "./errors";
import { ApiError } from "./http";
import { formatTimeLeft, gradeLabel, secondsUntil } from "./labels";
import {
  activeEnrollment,
  firstUnansweredIndex,
  latestSubmittedRun,
} from "./runs";
import type { Enrollment, StudentRun } from "./types";

describe("errors", () => {
  it("wraps anything thrown as an ApiError", () => {
    const original = new ApiError({ status: 409, code: "STALE", detail: "x" });
    expect(asApiError(original)).toBe(original);
    const network = asApiError(new TypeError("Failed to fetch"));
    expect(network.code).toBe("NETWORK");
    expect(isUnexpected(network)).toBe(true);
  });

  it("treats branchable codes as expected and SYSTEM as unexpected", () => {
    expect(
      isUnexpected(new ApiError({ status: 422, code: "CODE_INCORRECT" })),
    ).toBe(false);
    expect(isUnexpected(localError("Fill it in"))).toBe(false);
    expect(isUnexpected(new ApiError({ status: 500 }))).toBe(true);
  });

  it("hides the form-level line only when every field is shown by its input", () => {
    const nickname = new ApiError({
      status: 409,
      code: "NICKNAME_TAKEN",
      detail: "Taken",
      fields: [{ field: "nickname", message: "That nickname is taken" }],
    });
    const contact = new ApiError({
      status: 409,
      code: "CONTACT_IN_USE",
      detail: "In use",
      fields: [{ field: "contact", message: "In use" }],
    });
    expect(formLevelError(nickname, ["nickname"])).toBeNull();
    expect(formLevelError(contact, ["nickname"])).toBe(contact);
    expect(formLevelError(null, [])).toBeNull();
  });

  it("recognises a lost session", () => {
    expect(
      isSignedOut(new ApiError({ status: 401, code: "NOT_SIGNED_IN" })),
    ).toBe(true);
    expect(isSignedOut(new ApiError({ status: 403, code: "FORBIDDEN" }))).toBe(
      false,
    );
  });
});

describe("labels", () => {
  it("labels grades like the server's gradeLabel", () => {
    expect(gradeLabel("SHS_2")).toBe("SHS 2");
    expect(gradeLabel("YEAR_1")).toBe("Year 1");
  });

  it("formats time left", () => {
    expect(formatTimeLeft(3 * 86400 + 2 * 3600)).toBe("3d 2h");
    expect(formatTimeLeft(2 * 3600 + 5 * 60)).toBe("2h 05m");
    expect(formatTimeLeft(754)).toBe("12:34");
    expect(formatTimeLeft(-5)).toBe("0:00");
  });

  it("counts seconds until an instant", () => {
    const now = Date.parse("2026-10-20T10:00:00Z");
    expect(secondsUntil("2026-10-20T10:01:30Z", now)).toBe(90);
    expect(secondsUntil("2026-10-20T09:00:00Z", now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(0);
  });
});

describe("runs", () => {
  const run = (over: Partial<StudentRun>): StudentRun =>
    ({
      id: "r",
      versionCode: "nsmq26",
      status: "SUBMITTED",
      submittedAt: "2026-10-19T10:00:00Z",
      ...over,
    }) as StudentRun;

  it("picks the active enrollment", () => {
    const list = [
      { versionCode: "a", status: "SUSPENDED" },
      { versionCode: "b", status: "ACTIVE" },
    ] as Enrollment[];
    expect(activeEnrollment(list)?.versionCode).toBe("b");
    expect(activeEnrollment([])).toBeNull();
  });

  it("finds the latest submitted run for a version", () => {
    const runs = [
      run({ id: "old" }),
      run({ id: "new", submittedAt: "2026-10-20T08:00:00Z" }),
      run({ id: "open", status: "IN_PROGRESS", submittedAt: null }),
      run({
        id: "other",
        versionCode: "x",
        submittedAt: "2026-10-21T08:00:00Z",
      }),
    ];
    expect(latestSubmittedRun(runs, "nsmq26")?.id).toBe("new");
    expect(latestSubmittedRun([], "nsmq26")).toBeNull();
  });

  it("resumes at the first unanswered item", () => {
    expect(firstUnansweredIndex(["a", "b", "c"], new Set(["a"]))).toBe(1);
    expect(firstUnansweredIndex(["a", "b"], new Set(["a", "b"]))).toBe(1);
    expect(firstUnansweredIndex([], new Set())).toBe(0);
  });
});
