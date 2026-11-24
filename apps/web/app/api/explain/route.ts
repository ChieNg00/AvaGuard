import { NextResponse } from "next/server";
import { hashSchema } from "@avaguard/analyzer";
import { BoundedReadError, readBoundedJson } from "../../../lib/bounded-read";
import {
  getExplainRuntime,
  MAX_HASH_REQUEST_BYTES,
  MAX_TOKEN_REQUEST_BYTES,
} from "../../../lib/explain-server";

export async function POST(request: Request) {
  const runtime = getExplainRuntime();
  const tokenMode =
    typeof runtime.hasTokenSecret === "function" && runtime.hasTokenSecret();
  const maxRequestBytes = tokenMode
    ? MAX_TOKEN_REQUEST_BYTES
    : MAX_HASH_REQUEST_BYTES;

  let parsedJson: unknown;
  try {
    parsedJson = await readBoundedJson(request, maxRequestBytes);
  } catch (err) {
    if (err instanceof BoundedReadError) {
      if (err.kind === "oversized") {
        return NextResponse.json(
          { ok: false, error: "Explain request exceeds size limit." },
          { status: 413 },
        );
      }
      if (err.kind === "invalid-json") {
        return NextResponse.json(
          { ok: false, error: "Malformed JSON request." },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (
    !parsedJson ||
    typeof parsedJson !== "object" ||
    Array.isArray(parsedJson)
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid explain request payload." },
      { status: 400 },
    );
  }

  const record = parsedJson as Record<string, unknown>;
  const keys = Object.keys(record);
  const rawHash = record.reportHash;
  const parsedHash =
    typeof rawHash === "string"
      ? hashSchema.safeParse(rawHash.toLowerCase())
      : null;
  if (!parsedHash?.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid explain request payload." },
      { status: 400 },
    );
  }

  let result:
    | { ok: true; status: 200; explanation: unknown }
    | { ok: false; status: 400 | 404; error: string };

  if (keys.length === 1) {
    result = await runtime.explainByHash(parsedHash.data);
  } else if (
    tokenMode &&
    keys.length === 2 &&
    Object.prototype.hasOwnProperty.call(record, "explainToken") &&
    typeof record.explainToken === "string" &&
    record.explainToken.length > 0 &&
    typeof runtime.explainByToken === "function"
  ) {
    result = await runtime.explainByToken(parsedHash.data, record.explainToken);
  } else {
    return NextResponse.json(
      { ok: false, error: "Invalid explain request payload." },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(
    { ok: true, explanation: result.explanation },
    { status: 200 },
  );
}
