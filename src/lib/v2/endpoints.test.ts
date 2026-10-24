import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import * as auth from "./auth";
import * as campus from "./campus";
import * as nsmq from "./nsmq";
import * as patient from "./patient";

type FetchInit = RequestInit & { headers: Record<string, string> };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("v2 endpoint modules", () => {
  const fetchMock =
    vi.fn<(url: string, init: FetchInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    // a fresh Response per call - a body can only be read once
    fetchMock.mockImplementation(async () => json({}));
    vi.stubGlobal("fetch", fetchMock);
    // browser: same-origin, with the CSRF cookie already set
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=tok-1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function call(i = 0) {
    const [url, init] = fetchMock.mock.calls[i];
    return {
      url,
      method: init.method,
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
      headers: init.headers,
    };
  }

  describe("auth", () => {
    it("looks up a contact as a patient", async () => {
      await auth.lookup("0241234567");
      expect(call()).toMatchObject({
        url: "/auth/lookup",
        method: "POST",
        body: { contact: "0241234567", role: "PATIENT" },
        headers: { "X-XSRF-TOKEN": "tok-1" },
      });
    });

    it("signs up with exactly the contract's fields (no referral)", async () => {
      fetchMock.mockImplementation(
        async () => new Response(null, { status: 202 }),
      );
      const body = {
        contact: "+233241234567",
        password: "secret1",
        fullName: "Ama Kumi",
        nickname: "Ama",
        gender: "FEMALE" as const,
        dateOfBirth: "2009-04-12",
      };

      await expect(auth.signUp(body)).resolves.toBeUndefined();

      expect(call()).toMatchObject({
        url: "/auth/patient/sign-up",
        method: "POST",
      });
      expect(call().body).toEqual(body);
    });

    it("verifies, resends and recovers with role and purpose", async () => {
      await auth.verify("a@b.co", "SIGN_UP", "123456");
      await auth.resendCode("a@b.co", "RECOVERY");
      await auth.startRecovery("a@b.co");

      expect(call(0)).toMatchObject({
        url: "/auth/verify",
        body: {
          contact: "a@b.co",
          role: "PATIENT",
          purpose: "SIGN_UP",
          code: "123456",
        },
      });
      expect(call(1)).toMatchObject({
        url: "/auth/codes",
        body: { contact: "a@b.co", role: "PATIENT", purpose: "RECOVERY" },
      });
      expect(call(2)).toMatchObject({
        url: "/auth/recovery",
        body: { contact: "a@b.co", role: "PATIENT" },
      });
    });

    it("signs in and sets a password with the grant", async () => {
      await auth.signIn("a@b.co", "secret1");
      await auth.setPassword("g-1", "secret2");

      expect(call(0)).toMatchObject({
        url: "/auth/sign-in",
        method: "POST",
        body: { contact: "a@b.co", role: "PATIENT", password: "secret1" },
      });
      expect(call(1)).toMatchObject({
        url: "/auth/password",
        body: { grant: "g-1", password: "secret2" },
      });
    });

    it("reads the session and checks a nickname with a query string", async () => {
      await auth.getMe();
      await auth.isNicknameAvailable("Kofi_B");

      expect(call(0)).toMatchObject({ url: "/auth/me", method: "GET" });
      expect(call(0).headers).not.toHaveProperty("X-XSRF-TOKEN");
      expect(call(1).url).toBe("/patients/nickname-available?nickname=Kofi_B");
    });
  });

  describe("patient", () => {
    it("reads and patches the profile", async () => {
      await patient.getProfile();
      await patient.updateProfile({ nickname: "Ama" });

      expect(call(0)).toMatchObject({ url: "/patients/me", method: "GET" });
      expect(call(1)).toMatchObject({
        url: "/patients/me",
        method: "PATCH",
        body: { nickname: "Ama" },
      });
    });

    it("uploads the photo as multipart field `file`", async () => {
      await patient.uploadPhoto(new Blob(["x"], { type: "image/png" }));

      const { url, method, body, headers } = call();
      expect(url).toBe("/patients/me/photo");
      expect(method).toBe("PUT");
      expect(body).toBeInstanceOf(FormData);
      const file = (body as FormData).get("file") as File;
      expect(file.name).toBe("photo.png");
      // the browser sets the multipart boundary itself
      expect(headers).not.toHaveProperty("Content-Type");
    });

    it("skips the photo and saves each onboarding step", async () => {
      await patient.skipPhoto();
      await patient.setCampus("c-1");
      await patient.setProgramme("p-1");
      await patient.setGrade("SHS_2");
      await patient.finishOnboarding();

      expect(fetchMock.mock.calls.map((_, i) => call(i))).toMatchObject([
        { url: "/patients/me/photo/skip", method: "POST" },
        {
          url: "/patients/me/campus",
          method: "PUT",
          body: { campusId: "c-1" },
        },
        {
          url: "/patients/me/programme",
          method: "PUT",
          body: { programmeId: "p-1" },
        },
        { url: "/patients/me/grade", method: "PUT", body: { grade: "SHS_2" } },
        { url: "/patients/me/onboarding/finish", method: "POST" },
      ]);
    });
  });

  describe("campus", () => {
    it("lists campus types", async () => {
      await campus.getCampusTypes();
      expect(call()).toMatchObject({ url: "/campus-types", method: "GET" });
    });

    it("searches campuses paged, leaving out empty params", async () => {
      await campus.searchCampuses({
        card: "HIGH_SCHOOL",
        q: "",
        page: 2,
        size: 20,
      });
      expect(call().url).toBe("/campuses?card=HIGH_SCHOOL&page=2&size=20");
    });

    it("lists a campus's programmes", async () => {
      await campus.getProgrammes("c 1", "sci");
      expect(call().url).toBe("/campuses/c%201/programmes?q=sci");
    });
  });

  describe("nsmq", () => {
    it("reads a version and its campuses (public)", async () => {
      await nsmq.getVersion("nsmq26");
      await nsmq.getVersionCampuses("nsmq26", "accra");

      expect(call(0)).toMatchObject({ url: "/versions/nsmq26", method: "GET" });
      expect(call(1).url).toBe("/versions/nsmq26/campuses?q=accra");
    });

    it("enrolls, picks a campus, joins with assent and reads the status", async () => {
      await nsmq.getEnrollments();
      await nsmq.enroll("nsmq26");
      await nsmq.selectCampus("nsmq26", "c-1");
      await nsmq.join("nsmq26", {
        campusId: "c-1",
        code: "ABC123XYZ",
        assent: true,
      });
      await nsmq.acceptAssent("nsmq26");
      await nsmq.getStatus("nsmq26");

      expect(fetchMock.mock.calls.map((_, i) => call(i))).toMatchObject([
        { url: "/me/enrollments", method: "GET" },
        { url: "/me/enrollments/nsmq26", method: "POST" },
        {
          url: "/me/enrollments/nsmq26/campus",
          method: "PUT",
          body: { campusId: "c-1" },
        },
        {
          url: "/me/enrollments/nsmq26/join",
          method: "POST",
          body: { campusId: "c-1", code: "ABC123XYZ", assent: true },
        },
        { url: "/me/enrollments/nsmq26/assent", method: "POST" },
        { url: "/me/enrollments/nsmq26/status", method: "GET" },
      ]);
    });

    it("starts a run with or without a kind", async () => {
      await nsmq.startRun("nsmq26");
      await nsmq.startRun("nsmq26", "T3");

      expect(call(0)).toMatchObject({
        url: "/me/runs",
        method: "POST",
        body: { versionCode: "nsmq26" },
      });
      expect(call(0).body).not.toHaveProperty("kind");
      expect(call(1).body).toEqual({ versionCode: "nsmq26", kind: "T3" });
    });

    it("answers, submits, retakes, acknowledges care and opens the Waiting Room", async () => {
      await nsmq.getRuns();
      await nsmq.getRun("r-1");
      await nsmq.answer("r-1", "GMH_1", "o-1");
      await nsmq.submitRun("r-1");
      await nsmq.retakeRun("r-1");
      await nsmq.acknowledgeCare("r-1");
      await nsmq.getRunCare("r-1");

      expect(fetchMock.mock.calls.map((_, i) => call(i))).toMatchObject([
        { url: "/me/runs", method: "GET" },
        { url: "/me/runs/r-1", method: "GET" },
        {
          url: "/me/runs/r-1/answers/GMH_1",
          method: "PUT",
          body: { optionId: "o-1" },
        },
        { url: "/me/runs/r-1/submit", method: "POST" },
        { url: "/me/runs/r-1/retake", method: "POST" },
        { url: "/me/runs/r-1/care-ack", method: "POST" },
        { url: "/me/runs/r-1/care", method: "GET" },
      ]);
    });
  });
});
