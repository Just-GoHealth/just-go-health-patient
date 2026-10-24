import { cn } from "@just-gohealth/ui";
import type { ApiError } from "@/lib/v2/http";
import { isUnexpected } from "@/lib/v2/errors";

// one error line for every screen: the problem's `detail` as written, plus
// the traceId in small print when the error was unexpected (for support)
export function ApiErrorText({
  error,
  className,
}: {
  error: ApiError | null | undefined;
  className?: string;
}) {
  if (!error) return null;
  return (
    <div className={cn("text-sm", className)} role="alert">
      <p className="text-no">{error.message}</p>
      {error.traceId && isUnexpected(error) && (
        <p className="text-muted mt-1 text-[10px] tracking-wide">
          Ref: {error.traceId}
        </p>
      )}
    </div>
  );
}
