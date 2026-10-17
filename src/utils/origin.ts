const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HTTP_DEFAULT_PORT = 80;

// DNS-rebinding guard: the Host header must be loopback on the listener's port, and an Origin, when
// sent, must be that same origin. a request with no Origin (curl, same-origin GET) passes on Host alone.
export function isLoopbackRequest(req: Request, listenerPort: number): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  let hostUrl: URL;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (!isLoopbackHttpOrigin(hostUrl, listenerPort)) return false;
  const origin = req.headers.get("origin");
  return origin === null || origin === hostUrl.origin;
}

export function isLoopbackHttpOrigin(url: URL, listenerPort: number): boolean {
  return url.protocol === "http:"
    && LOOPBACK_HOSTS.has(url.hostname)
    && Number(url.port || HTTP_DEFAULT_PORT) === listenerPort;
}
