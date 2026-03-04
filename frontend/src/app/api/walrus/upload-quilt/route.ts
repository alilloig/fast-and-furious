import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL;

export async function POST(req: NextRequest) {
  if (!WALRUS_PUBLISHER_URL) {
    return NextResponse.json(
      { error: "Walrus publisher not configured" },
      { status: 503 },
    );
  }

  const formData = await req.formData();

  const outgoing = new FormData();
  for (const [key, value] of formData.entries()) {
    outgoing.append(key, value);
  }

  const response = await fetch(
    `${WALRUS_PUBLISHER_URL}/v1/quilts?epochs=5`,
    {
      method: "PUT",
      body: outgoing,
    },
  );
  const result = await response.json();
  if (!response.ok) {
    console.error("[upload-quilt] Walrus error:", response.status, result);
  }
  return NextResponse.json(result, { status: response.status });
}
