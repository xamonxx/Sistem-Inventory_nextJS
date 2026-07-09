import "server-only";

function portOf(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function originsMatch(a: URL, b: URL): boolean {
  if (a.protocol !== b.protocol || portOf(a) !== portOf(b)) return false;
  if (a.hostname === b.hostname) return true;
  return isLoopbackHost(a.hostname) && isLoopbackHost(b.hostname);
}

export function isSameOriginRequest(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const allowedOrigins = [requestUrl];
  const host = request.headers.get("host");
  if (host) {
    allowedOrigins.push(new URL(`${requestUrl.protocol}//${host}`));
  }

  const isAllowed = (value: string): boolean => {
    try {
      const candidate = new URL(value);
      return allowedOrigins.some((allowed) => originsMatch(candidate, allowed));
    } catch {
      return false;
    }
  };

  const origin = request.headers.get("origin");
  if (origin && !isAllowed(origin)) return false;

  const referer = request.headers.get("referer");
  if (referer && !isAllowed(referer)) return false;

  return true;
}
