const enc = new TextEncoder();

function b64Encode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function b64Decode(str: string): Uint8Array {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const ITERATIONS = 100000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$${ITERATIONS}$${b64Encode(salt)}$${b64Encode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const salt = b64Decode(parts[2]);
    const expected = b64Decode(parts[3]);
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial,
      expected.length * 8
    );
    const hash = new Uint8Array(bits);
    if (hash.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}