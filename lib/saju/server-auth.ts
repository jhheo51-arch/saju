type Authenticated = { status: "authenticated"; userId: string };
type Unauthenticated = { status: "unauthenticated" };
type Unavailable = { status: "unavailable" };

export type SajuAuthResult = Authenticated | Unauthenticated | Unavailable;

function accessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

export async function authenticateSajuRequest(
  request: Request,
  fetcher: typeof fetch = fetch,
): Promise<SajuAuthResult> {
  const token = accessToken(request);
  if (!token) return { status: "unauthenticated" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { status: "unavailable" };

  try {
    const response = await fetcher(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) return { status: "unauthenticated" };
    if (!response.ok) return { status: "unavailable" };
    const user = await response.json() as { id?: unknown };
    return typeof user.id === "string" && user.id.length > 0
      ? { status: "authenticated", userId: user.id }
      : { status: "unauthenticated" };
  } catch {
    return { status: "unavailable" };
  }
}
