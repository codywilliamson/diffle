const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HTTP_DEFAULT_PORT = 80;

export function isLoopbackHttpOrigin(url: URL, listenerPort: number): boolean {
  return url.protocol === "http:"
    && LOOPBACK_HOSTS.has(url.hostname)
    && Number(url.port || HTTP_DEFAULT_PORT) === listenerPort;
}
