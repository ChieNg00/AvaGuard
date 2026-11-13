import { NextResponse } from "next/server";
import { hashSchema } from "@avaguard/analyzer";
import { getExplainRuntime } from "../../../lib/explain-server";

const MAX_REQUEST_BYTES = 512;

export async function POST(request: Request) {
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }
  if (new TextEncoder().encode(rawText).byteLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Explain request exceeds size limit." },
      { status: 413 },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed JSON request." },
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
  const keys = Object.keys(parsedJson);
  const rawHash = (parsedJson as { reportHash?: unknown }).reportHash;
  const parsedHash =
    keys.length === 1 && typeof rawHash === "string"
      ? hashSchema.safeParse(rawHash.toLowerCase())
      : null;
  if (!parsedHash?.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid explain request payload." },
      { status: 400 },
    );
  }

  const result = await getExplainRuntime().explainByHash(parsedHash.data);
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
