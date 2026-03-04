import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL;

export async function POST(req: NextRequest) {
  if (!WALRUS_PUBLISHER_URL) {
    return NextResponse.json(
      { error: "Walrus publisher not configured" },
      { status: 503 },
    );
  }

  const body = await req.arrayBuffer();
  const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs`, {
    method: "PUT",
    body,
    headers: { "Content-Type": "application/octet-stream" },
  });
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}
