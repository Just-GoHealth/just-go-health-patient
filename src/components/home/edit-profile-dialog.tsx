"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  ToggleGroup,
} from "@just-gohealth/ui";
import { ApiErrorText } from "@/components/shared/api-error-text";
import type { ApiError } from "@/lib/v2/http";
import { asApiError } from "@/lib/v2/errors";
import { updateProfile } from "@/lib/v2/patient";
import type { Gender, PatientHome, PatientPatchRequest } from "@/lib/v2/types";
import { useNicknameCheck } from "@/lib/v2/use-nickname-check";
import { useRateLimit } from "@/lib/v2/use-rate-limit";

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

// letters, numbers and _ . ' - (no spaces), 30 at most - the server's rule
function sanitizeNickname(raw: string): string {
  return raw.replace(/[^\p{L}\p{M}\p{N}_.'’-]/gu, "").slice(0, 30);
}

const inputClass = "rounded-xl text-txt placeholder:text-muted";

// Edits the home profile with PATCH /patients/me, sending only what changed.
// The school is shown but can't be changed by the student.
export function EditProfileDialog({
  open,
  profile,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  profile: PatientHome;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: PatientHome) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [nickname, setNickname] = useState(profile.nickname);
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const nicknameTaken = useNicknameCheck(nickname, profile.nickname);
  const rateLimit = useRateLimit();

  async function save() {
    const patch: PatientPatchRequest = {};
    if (fullName.trim() !== profile.fullName) patch.fullName = fullName.trim();
    if (nickname.trim() !== profile.nickname) patch.nickname = nickname.trim();
    if (gender !== profile.gender) patch.gender = gender;
    if (dateOfBirth !== profile.dateOfBirth) patch.dateOfBirth = dateOfBirth;
    if (!Object.keys(patch).length) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateProfile(patch));
      onOpenChange(false);
    } catch (e) {
      const err = asApiError(e);
      rateLimit.trip(err);
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Edit your profile</DialogTitle>
          <DialogDescription>
            Your school can only be changed by JustGo Health.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Your name" error={error?.fieldError("fullName")}>
            <Input
              className={inputClass}
              maxLength={100}
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field
            label="Nickname"
            error={nicknameTaken ?? error?.fieldError("nickname")}
          >
            <Input
              className={inputClass}
              value={nickname}
              onChange={(e) => setNickname(sanitizeNickname(e.target.value))}
            />
          </Field>
          <Field label="Gender" error={error?.fieldError("gender")}>
            <ToggleGroup
              type="single"
              fullWidth
              aria-label="Gender"
              options={GENDER_OPTIONS}
              value={gender}
              onValueChange={(v) => {
                if (v) setGender(v as Gender);
              }}
              className="border-line border bg-white/5"
            />
          </Field>
          <Field label="Date of birth" error={error?.fieldError("dateOfBirth")}>
            <Input
              className={inputClass}
              type="date"
              min="1980-01-01"
              max="2015-12-31"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </Field>
          {profile.campus && (
            <Field
              label="School"
              description="Your school can only be changed by JustGo Health."
            >
              <Input
                className={inputClass}
                readOnly
                disabled
                value={profile.campus.fullName}
              />
            </Field>
          )}
          <ApiErrorText error={error?.fields.length ? null : error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || rateLimit.limited || !!nicknameTaken}
            >
              {rateLimit.label ?? (saving ? "Saving…" : "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
