import { NextRequest, NextResponse } from "next/server";

const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quiltId: string; identifier: string }> },
) {
  if (!WALRUS_AGGREGATOR_URL) {
    return NextResponse.json(
      { error: "Walrus aggregator not configured" },
      { status: 503 },
    );
  }

  const { quiltId, identifier } = await params;
  const response = await fetch(
    `${WALRUS_AGGREGATOR_URL}/v1/blobs/by-quilt-id/${quiltId}/${identifier}`,
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Quilt blob not found" },
      { status: response.status },
    );
  }

  const blob = await response.arrayBuffer();
  return new NextResponse(blob, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}
