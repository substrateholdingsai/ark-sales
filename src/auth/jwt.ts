const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  name?: string;
  iat: number;
  exp: number;
  iss?: string;
};

export async function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, secret: string, ttlSeconds = 8 * 60 * 60): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(full)));
  const data = `${h}.${p}`;
  const sig = await hmacSign(secret, data);
  const s = b64urlEncode(sig);
  return `${data}.${s}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const data = `${h}.${p}`;
    const expected = await hmacSign(secret, data);
    const provided = b64urlDecode(s);
    if (provided.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
    if (diff !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.role !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}