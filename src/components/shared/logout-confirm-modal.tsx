"use client";

import { ConfirmDialog } from "@just-gohealth/ui";

// the logout confirmation's copy in one place - the dialog itself is the
// shared ConfirmDialog (focus trap, Esc to cancel, stays open while loading)
export function LogoutConfirmModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      tone="destructive"
      title="Log out?"
      description="Your answers and your account go with you. The version you were invited to stays."
      cancelLabel="Stay logged in"
      confirmLabel={loading ? "Logging out…" : "Log out"}
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}
