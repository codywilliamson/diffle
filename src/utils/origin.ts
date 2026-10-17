const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HTTP_DEFAULT_PORT = 80;
// the review server binds here only, never all interfaces
export const LOOPBACK_BIND_HOST = "127.0.0.1";
// strict authority: one loopback name and an optional single port. no userinfo, path, whitespace or extra colons.
const LOOPBACK_AUTHORITY = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

export type RequestGuardResult = "ok" | "host" | "origin";

// DNS-rebinding guard for every route: the Host header must be loopback on the listener's port
// ("host"), and an Origin, when sent, must be that same origin ("origin"). a request with no
// Origin (curl, same-origin GET) passes on Host alone.
export function checkLoopbackRequest(req: Request, listenerPort: number): RequestGuardResult {
  const host = req.headers.get("host");
  if (!host) return "host";
  if (!LOOPBACK_AUTHORITY.test(host)) return "host";
  let hostUrl: URL;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return "host";
  }
  if (!isLoopbackHttpOrigin(hostUrl, listenerPort)) return "host";
  const origin = req.headers.get("origin");
  return origin === null || origin === hostUrl.origin ? "ok" : "origin";
}

export function isLoopbackHttpOrigin(url: URL, listenerPort: number): boolean {
  return url.protocol === "http:"
    && LOOPBACK_HOSTS.has(url.hostname)
    && Number(url.port || HTTP_DEFAULT_PORT) === listenerPort;
}
