// End-to-end encryption for cross-device sync.
//
// The passphrase never leaves the browser. From it we derive 64 bytes with
// PBKDF2: the first half is the AES-GCM key, the second half is hashed into a
// "vault id" that names the folder on the server. The server only ever sees
// the vault id and ciphertext, so it can't read chats or API keys.

const SALT = "flux.ai-sync-v1";
const ITERATIONS = 600_000;

const FORMAT_JSON = 1;
const FORMAT_GZIP = 2;

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface VaultKeys {
  key: CryptoKey;
  /** Raw AES key bytes, base64 — kept on this device so the passphrase isn't needed again. */
  rawKey: string;
  /** 64-char hex id naming this vault on the server. */
  vaultId: string;
}

export function normalizePassphrase(p: string): string {
  return p.normalize("NFKC").trim();
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveVault(passphrase: string): Promise<VaultKeys> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalizePassphrase(passphrase)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALT), iterations: ITERATIONS },
      material,
      512
    )
  );
  const raw = bits.slice(0, 32);
  const vaultId = toHex(await crypto.subtle.digest("SHA-256", bits.slice(32)));
  return { key: await importKey(raw), rawKey: toBase64(raw), vaultId };
}

export function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== "undefined";

/**
 * Encrypt a JSON value. `path` is bound in as associated data, so a blob
 * can't be swapped for another one (say, meta for a chat) without detection.
 */
export async function sealJson(key: CryptoKey, path: string, value: unknown): Promise<Uint8Array> {
  let body = enc.encode(JSON.stringify(value));
  let format = FORMAT_JSON;
  if (canCompress()) {
    body = await pipe(body, new CompressionStream("gzip"));
    format = FORMAT_GZIP;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(path) },
      key,
      body
    )
  );
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = format;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return out;
}

export class WrongKeyError extends Error {
  constructor() {
    super("This data couldn't be decrypted. The passphrase may be different from the one used on your other device.");
  }
}

export async function openJson<T = unknown>(key: CryptoKey, path: string, data: Uint8Array): Promise<T> {
  const format = data[0];
  if (format !== FORMAT_JSON && format !== FORMAT_GZIP) {
    throw new Error("Unrecognized sync data format.");
  }
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: data.subarray(1, 13), additionalData: enc.encode(path) },
        key,
        data.subarray(13)
      )
    );
  } catch {
    throw new WrongKeyError();
  }
  if (format === FORMAT_GZIP) plain = await pipe(plain, new DecompressionStream("gzip"));
  return JSON.parse(dec.decode(plain)) as T;
}

/** Short hash used to detect whether an item changed. */
export async function digest(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text))).slice(0, 24);
}

/** JSON with sorted keys, so the same value hashes the same on every device. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

const WORDS =
  "amber anchor apple arrow aspen atlas autumn badge bamboo banner basil beacon berry birch bloom breeze bridge brook cabin cactus candle canyon cedar cherry cider cloud clover cobalt comet copper coral cosmos cotton crane crystal dahlia dawn delta desert dune eagle echo ember falcon fern fjord flame flint forest fossil frost galaxy garnet ginger glacier granite harbor hazel heron honey horizon indigo iris island ivory jade jasmine juniper kettle kiwi lagoon lantern lava lemon lilac linen lotus lunar maple marble meadow mesa meteor mint mirror mist monsoon moss nebula nectar nova oasis ocean olive onyx orbit orchid otter pebble pepper pine planet plum polar poppy prism quartz quill radar raven reef ripple river robin saffron sage sapphire shadow sierra silver sparrow spruce storm summit sunset tango thistle thunder tide timber topaz tulip tundra velvet violet walnut willow winter zephyr";

/** A random six words plus four digits (~56 bits), stretched further by PBKDF2. */
export function generatePassphrase(): string {
  const words = WORDS.split(" ");
  const rand = crypto.getRandomValues(new Uint32Array(7));
  const picks = Array.from(rand.slice(0, 6), (n) => words[n % words.length]);
  return `${picks.join("-")}-${String(rand[6] % 10000).padStart(4, "0")}`;
}
