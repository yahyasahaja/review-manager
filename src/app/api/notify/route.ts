import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { webhookUrl, text, threadKey } = await request.json();

    if (!webhookUrl || !text) {
      return NextResponse.json({ error: "Missing webhookUrl or text" }, { status: 400 });
    }

    // Add messageReplyOption query parameter to the webhook URL
    const url = new URL(webhookUrl);
    url.searchParams.set("messageReplyOption", "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");

    // Build request body with optional thread object
    const requestBody: { text: string; thread?: { threadKey: string } } = { text };
    if (threadKey) {
      requestBody.thread = { threadKey };
    }

    // The webhookUrl is now the full URL provided by the user
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "Google Chat API error", details: errorText }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
