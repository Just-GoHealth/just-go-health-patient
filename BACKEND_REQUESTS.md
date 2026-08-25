# Backend asks — screening results & retake

## 1. [P0] Provider patient-list endpoints return correct counts but zero rows

**Confirmed live, independent of any frontend code** — this blocks all patient
browsing for providers, separate from the dome/board gap below.

**What's happening:** The endpoints that back the main provider patient roster
return the right `totalCount`, but an empty `patients: []` array:

- `GET /api/provider/dashboard-init` — schools show real counts (60, 33, 38...) but
  `patients: []`
- `GET /api/provider/patients` (unfiltered, and filtered by `schoolId=4`) —
  `totalCount: 248` / `60`, but `patients: []` both times
- `GET /v1/schools/4/patients-overview` — same: `patients: []`

**The data genuinely exists**, and other query shapes against the same data work
fine:

- `GET /api/provider/patients/urgent` — returns 83 real patients (names, scores,
  schoolIds) correctly
- `GET /api/v1/patient-results/460` (single record by id) — returns the full real
  record correctly
- `GET /api/v1/lockin/updates/1403` (that patient's dome data) — returns the full
  real assessment breakdown correctly

So the bug is narrowly scoped: whatever query backs the main patient list/roster (as
opposed to the urgent-care sub-list or a single-record lookup) returns the right
total count but serializes zero actual rows. This is a backend defect — no frontend
list can ever populate no matter what changes on the client, since the API itself
hands back an empty array.

**Aside, not a bug:** every one of the 83 urgent patients has `avatarUrl: null` /
`profilePhotoURL: null` — genuinely no photo uploaded, correctly falling back to
initials. The `next/image` robustness fix from earlier is still worth keeping for
whenever a photo *is* present, it just isn't the reason nothing showed for this
account's data.

## 2. ~~Contest-day (T3 / PRE_SHORT) submissions come back with no results data~~ — FIXED

**Endpoint:** `GET /v1/patients/screenings/latest`

Backend confirmed the fix and it's reflected in the updated OpenAPI spec
(`api-docs (1).json`, 2026-08-25). The description changed from *"204 when there is
nothing to draw, including after a contest-day run, which is scored and stored but
deliberately shows no board"* to *"The most recently submitted run for the version,
contest day included. 204 only when the patient has never submitted one."*

Frontend already reads from this endpoint on `/home` and had a sessionStorage
carry-over as a workaround for the old behavior — kept in place, but now only as a
bridge for brief propagation lag right after submit, not the primary path.

## 3. ~~No endpoint to retake an already-submitted screening~~ — FIXED, wired up

**Endpoint:** `POST /v1/patients/screenings/{screeningId}/retake` (new, per the
2026-08-25 spec update)

> "Opens a fresh attempt at the same window and returns it exactly as starting one
> does. The earlier attempt is kept and stays readable by the providers it was
> routed to. 409 `SCREENING_NOT_SUBMITTED` if the run is still open, and 409
> `SCREENING_WINDOW_CLOSED` once the window has moved on. If an attempt is already
> open for the window, that one is returned instead."

The endpoint exists now. The frontend's "Retake Testing" button on `/home` is wired
to it: on click, calls `retake`, then routes to `/screening` to begin the fresh
attempt. `SCREENING_WINDOW_CLOSED` shows a toast explaining the window's closed;
`SCREENING_NOT_SUBMITTED` (the current attempt turned out to still be open) just
routes to `/screening` to resume it instead of treating that as a failure.

## 4. Provider/curator patient-detail "dome" doesn't match what the patient sees

**Current state:** Opening a patient on the provider or curator side renders three
fixed dome tiles — General Mental Health, Exam Anxiety, Exam Prep — built from
`GET /api/v1/lockin/updates/{lockinId}` (`LockinUpdateResponse`: hardcoded named
score/description fields, no severity tag, no dynamic section count). Meanwhile the
patient's own app (just-go-patient) renders its dome from `BoardSection[]` — a
dynamic, server-computed list (`key`, `title`, `time`, `score`, `max`, `band`, `fam`,
`emergency`, `items`), sourced from `GET /v1/patients/screenings/latest`, explicitly
documented there as "server-decided, never recompute client-side."

**What's missing:** The schema for the real dome already exists in the backend's own
OpenAPI spec — `BoardResponse`/`BoardSectionResponse` — but every operation that
returns it is tagged *Patient Screenings* and lives under `/v1/patients/screenings/**`.
There is no equivalent route for a provider or curator to fetch the same board for a
given patient/result. The closest provider/curator-reachable thing is
`POST /v1/patient-results/nsmq/care-cases/{id}/clear` (write-only, requires
`nsmqCounsellor: true`), which returns only a 6-field summary (`effectiveTag`,
`sourceScreeningId`, timestamps) — not the section breakdown.

**What we need:** A read endpoint — e.g. `GET /v1/patient-results/{resultId}/board`
or `GET /v1/schools/{schoolId}/patients/{patientId}/board` — returning the same
`BoardResponse`/`BoardSectionResponse` shape already defined for patients, authorized
for `ROLE_PROVIDER`/`ROLE_CURATOR` with the same school/result access checks the rest
of `/v1/patient-results/**` already uses. Once that exists, the provider/curator dome
can render the patient's real per-category board (score/max/band/items, dynamic
section count, tag/reasonCode) instead of the separate, older `LockinUpdateResponse`
shape — the same screen both roles currently disagree with the patient on.
