"use client";

import { useEffect, useState } from "react";
import { isNicknameAvailable } from "./auth";

const DEBOUNCE_MS = 300;
export const NICKNAME_TAKEN_MESSAGE = "That nickname is taken";

/**
 * Live nickname check, debounced 300 ms after typing stops (the lookup and
 * nickname check share a per-browser rate limit). `skip` is the student's
 * current nickname, which always counts as free.
 */
export function useNicknameCheck(nickname: string, skip?: string) {
  const [taken, setTaken] = useState<{ nickname: string } | null>(null);
  const value = nickname.trim();

  useEffect(() => {
    if (!value || value.toLowerCase() === skip?.toLowerCase()) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      isNicknameAvailable(value, controller.signal)
        .then((res) => setTaken(res?.available ? null : { nickname: value }))
        .catch(() => {
          // best effort - sign-up/save still answers NICKNAME_TAKEN
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [value, skip]);

  // only the result for the nickname currently typed counts
  return taken?.nickname === value ? NICKNAME_TAKEN_MESSAGE : undefined;
}
