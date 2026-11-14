export type BoundedReadErrorKind =
  | "oversized"
  | "aborted"
  | "unreadable"
  | "invalid-utf8"
  | "invalid-json";

export class BoundedReadError extends Error {
  readonly kind: BoundedReadErrorKind;
  constructor(kind: BoundedReadErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export async function readBoundedText(
  message: Pick<Request | Response, "headers" | "body">,
  maxBytes: number,
): Promise<string> {
  const rawLength = message.headers.get("content-length");
  if (rawLength !== null) {
    const trimmed = rawLength.trim();
    if (/^\d+$/.test(trimmed)) {
      const declared = Number(trimmed);
      if (Number.isFinite(declared) && declared > maxBytes) {
        await message.body?.cancel().catch(() => {});
        throw new BoundedReadError(
          "oversized",
          `Declared Content-Length exceeds ${maxBytes} bytes.`,
        );
      }
    }
  }

  const stream = message.body;
  if (!stream) {
    return "";
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let overflow = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      if (totalBytes + value.byteLength > maxBytes) {
        overflow = true;
        await reader.cancel().catch(() => {});
        break;
      }
      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } catch (err) {
    await reader.cancel().catch(() => {});
    if (err instanceof Error && err.name === "AbortError") {
      throw new BoundedReadError("aborted", "Stream read aborted.");
    }
    throw new BoundedReadError("unreadable", "Failed reading stream body.");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader already released or stream closed.
    }
  }

  if (overflow) {
    throw new BoundedReadError(
      "oversized",
      `Stream exceeded ${maxBytes} byte limit.`,
    );
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new BoundedReadError(
      "invalid-utf8",
      "Invalid UTF-8 byte sequence in body.",
    );
  }
}

export async function readBoundedJson(
  message: Pick<Request | Response, "headers" | "body">,
  maxBytes: number,
): Promise<unknown> {
  const text = await readBoundedText(message, maxBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BoundedReadError("invalid-json", "Body is not valid JSON.");
  }
}
