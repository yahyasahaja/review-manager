import { NextResponse } from "next/server";

// Extract space name from webhook URL
function extractSpaceName(webhookUrl: string): string | null {
  try {
    const url = new URL(webhookUrl);
    const pathParts = url.pathname.split('/');
    const spacesIndex = pathParts.indexOf('spaces');
    if (spacesIndex !== -1 && pathParts[spacesIndex + 1]) {
      return pathParts[spacesIndex + 1];
    }
    return null;
  } catch (error) {
    console.error('Failed to extract space name from webhook URL:', error);
    return null;
  }
}

// Extract API key from webhook URL
function extractApiKey(webhookUrl: string): string | null {
  try {
    const url = new URL(webhookUrl);
    const apiKey = url.searchParams.get('key');
    return apiKey;
  } catch (error) {
    console.error('Failed to extract API key from webhook URL:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { webhookUrl, accessToken } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: "Missing webhookUrl" }, { status: 400 });
    }

    // Extract space name from webhook URL
    const spaceName = extractSpaceName(webhookUrl);

    if (!spaceName) {
      return NextResponse.json({ error: "Could not extract space name from webhook URL" }, { status: 400 });
    }

    // Use OAuth2 access token if provided
    if (!accessToken) {
      return NextResponse.json({
        error: "OAuth2 access token required. Please sign in with Google to fetch space members.",
        message: "Google Chat API requires OAuth2 authentication. The webhook API key can only be used for sending messages, not for listing members. Please sign in again to grant Chat API permissions."
      }, { status: 401 });
    }

    // Use the provided OAuth access token from Firebase sign-in
    const url = `https://chat.googleapis.com/v1/spaces/${spaceName}/members`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Chat API error:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      // Check for different error types
      const isScopeError = errorData?.error?.message?.includes("insufficient authentication scopes") ||
                          errorData?.error?.message?.includes("insufficient authentication");

      const isNotFoundError = errorData?.error?.code === 404 ||
                             errorData?.error?.message?.includes("Chat app not found") ||
                             errorData?.error?.status === "NOT_FOUND";

      let message = "Google Chat API requires OAuth2 authentication. API keys from webhooks cannot be used to list members. Please manually enter Google Chat User IDs in room settings, or the system will fall back to email mentions.";

      if (isScopeError) {
        message = "Insufficient authentication scopes. Please sign out and sign in again to grant Chat API permissions. Make sure the OAuth consent screen in Google Cloud Console includes the 'chat.memberships.readonly' scope.";
      } else if (isNotFoundError) {
        message = "Google Chat API requires Google Workspace.\n\n" +
          "IMPORTANT: The Google Chat API is only available for Google Workspace accounts, not regular Gmail accounts.\n\n" +
          "If you have Google Workspace, the application owner needs to:\n" +
          "1. Enable the Google Chat API: https://console.cloud.google.com/marketplace/product/google/chat.googleapis.com\n" +
          "2. Configure your Chat app: https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat\n" +
          "3. Add 'chat.memberships.readonly' scope to OAuth consent screen\n\n" +
          "If you don't have Google Workspace, you can still use the app by manually entering emails.";
      }

      // Google Chat API requires OAuth2, not API keys
      // Return a clear error message
      return NextResponse.json(
        {
          error: "Failed to fetch members",
          details: errorText,
          message,
          isScopeError,
          isNotFoundError
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Return the full response with memberships array
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Google Chat members:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

