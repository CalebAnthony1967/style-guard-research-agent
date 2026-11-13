const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return toHex(new Uint8Array(digest));
  }
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < input.length; i += 1) {
    h1 = (h1 ^ input.charCodeAt(i)) * 16777619;
    h2 = (h2 + input.charCodeAt(i) * (i + 7)) >>> 0;
  }
  const part = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return `${part(h1)}${part(h2)}${part(h1 ^ h2)}${part(h1 + h2)}${part(h1 * 3)}${part(h2 * 5)}${part(h1 ^ 7)}${part(h2 ^ 11)}`;
}