// Sends an error caught by a client error boundary to the server so it lands
// in `pm2 logs`. Fire-and-forget; never throws.
export function reportClientError(
  error: Error & { digest?: string },
  boundary: string,
) {
  try {
    const payload = JSON.stringify({
      boundary,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    // keepalive lets the request survive a navigation/unmount.
    void fetch("/api/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow — reporting errors must never cascade
  }
}
