import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function isSafeDomain(d: string): boolean {
  if (!d || d.length > 253) return false;
  if (!DOMAIN_RE.test(d)) return false;
  if (IPV4_RE.test(d)) return false;
  const lower = d.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return false;
  return true;
}

async function tryFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") || "0");
    // Google S2 returns a generic 16x16 placeholder (~300B) when favicon is unknown
    if (len > 0 && len < 200) return null;
    return res;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = (searchParams.get("domain") || "").trim().toLowerCase();

  if (!isSafeDomain(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const encoded = encodeURIComponent(domain);
  const providers = [
    `https://www.google.com/s2/favicons?domain=${encoded}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${encoded}.ico`,
  ];

  for (const url of providers) {
    const res = await tryFetch(url);
    if (res) {
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  return NextResponse.json({ error: "Favicon not found" }, { status: 404 });
}
