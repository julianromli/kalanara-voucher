import { NextRequest, NextResponse } from "next/server";

function collectInterestingHeaders(request: NextRequest) {
  const interestingHeaders = [
    "content-type",
    "user-agent",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-real-ip",
    "x-signature",
    "x-signing-secret",
    "x-webhook-signature",
    "x-scalev-signature",
    "x-scalev-event",
  ];

  return interestingHeaders.reduce<Record<string, string>>((headers, key) => {
    const value = request.headers.get(key);

    if (value) {
      headers[key] = value;
    }

    return headers;
  }, {});
}

async function buildWebhookSnapshot(request: NextRequest) {
  const rawBody = await request.text();
  let parsedBody: unknown = rawBody;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  return {
    method: request.method,
    url: request.url,
    headers: collectInterestingHeaders(request),
    body: parsedBody,
  };
}

export async function GET(request: NextRequest) {
  const snapshot = await buildWebhookSnapshot(request);
  console.log("[Scalev Webhook] Handshake received", snapshot);

  return NextResponse.json({
    ok: true,
    provider: "scalev",
    message: "Webhook endpoint is ready",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const snapshot = await buildWebhookSnapshot(request);
  console.log("[Scalev Webhook] Event received", snapshot);

  return NextResponse.json({
    ok: true,
    provider: "scalev",
    message: "Webhook received",
  });
}
