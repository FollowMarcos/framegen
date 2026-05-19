// Extracts the most useful human-readable message out of an error thrown by
// @fal-ai/client. The client typically throws with a generic `.message`
// (e.g. "Unprocessable Entity") but stashes the real reason in `.body`,
// `.body.detail`, `.body.errors`, or `.cause`. We dig through those shapes
// defensively and surface whichever contains an actual sentence.
//
// Used by API routes that wrap fal.subscribe so the client sees what fal
// actually rejected (image too large, content policy, etc.) instead of an
// HTTP status name.

type FalDetail = string | { msg?: string; message?: string; loc?: unknown };

function pickMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    // Pydantic-style validation errors arrive as a list of { loc, msg, type }.
    const msgs = value
      .map((v: FalDetail) =>
        typeof v === "string"
          ? v
          : v && (v.msg || v.message)
            ? `${v.msg ?? v.message}${v.loc ? ` (${JSON.stringify(v.loc)})` : ""}`
            : null
      )
      .filter((m): m is string => Boolean(m && m.trim()));
    if (msgs.length > 0) return msgs.join("; ");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      pickMessage(obj.detail) ||
      pickMessage(obj.errors) ||
      pickMessage(obj.error) ||
      pickMessage(obj.message) ||
      null
    );
  }
  return null;
}

export function falErrorMessage(err: unknown, fallback = "generation failed"): string {
  if (!err) return fallback;
  if (err instanceof Error) {
    const body = (err as unknown as { body?: unknown }).body;
    const cause = (err as unknown as { cause?: unknown }).cause;
    const detail =
      pickMessage(body) ||
      pickMessage(cause) ||
      pickMessage((err as unknown as { detail?: unknown }).detail);
    if (detail) {
      // If the bare message is just an HTTP status name (Unprocessable
      // Entity, Bad Request, etc.) hide it; otherwise include it for
      // context.
      const status = err.message.trim();
      const looksLikeStatus = /^[A-Z][a-zA-Z ]+$/.test(status) && status.length < 40;
      return looksLikeStatus ? detail : `${status}: ${detail}`;
    }
    return err.message || fallback;
  }
  if (typeof err === "string") return err;
  return pickMessage(err) || fallback;
}
