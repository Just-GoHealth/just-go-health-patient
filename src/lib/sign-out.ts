import { ONBOARD_STORAGE_KEY } from "@/lib/constants";
import { signOut } from "@/lib/v2/http";
import { clearVersionCode } from "@/lib/version-link";

/** Ends the session on the server (clears the cookies) and drops local progress. */
export async function signOutPatient(): Promise<void> {
  await signOut();
  try {
    localStorage.removeItem(ONBOARD_STORAGE_KEY);
  } catch {
    // ignore unavailable storage (e.g. private browsing)
  }
  clearVersionCode();
}
