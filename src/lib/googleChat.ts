interface GoogleChatConfig {
  webhookUrl: string;
}

interface GoogleChatMember {
  name: string;
  state: string;
  member?: {
    name: string;
    displayName: string;
    email: string;
    type: string;
  };
}

interface GoogleChatMembersResponse {
  memberships: Array<{
    name: string;
    state: string;
    member?: {
      name: string;
      displayName: string;
      email: string;
      type: string;
    };
  }>;
  nextPageToken?: string;
}

// Extract space name from webhook URL
// Format: https://chat.googleapis.com/v1/spaces/{SPACE}/messages?key=...&token=...
export function extractSpaceName(webhookUrl: string): string | null {
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
// Format: https://chat.googleapis.com/v1/spaces/{SPACE}/messages?key={API_KEY}&token={TOKEN}
export function extractApiKey(webhookUrl: string): string | null {
  try {
    const url = new URL(webhookUrl);
    const apiKey = url.searchParams.get('key');
    return apiKey;
  } catch (error) {
    console.error('Failed to extract API key from webhook URL:', error);
    return null;
  }
}

// Fetch Google Chat space members and return as array
export interface SpaceMember {
  email: string;
  displayName: string;
  userId?: string;
}

export async function fetchSpaceMembersList(webhookUrl: string, accessToken?: string): Promise<SpaceMember[]> {
  const spaceName = extractSpaceName(webhookUrl);
  if (!spaceName) {
    console.warn('Could not extract space name from webhook URL');
    return [];
  }

  try {
    const response = await fetch('/api/google-chat/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhookUrl, accessToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
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

      if (isScopeError) {
        const error = new Error("insufficient authentication scopes");
        (error as any).isScopeError = true;
        throw error;
      }

      if (isNotFoundError) {
        const error = new Error("Google Chat API not enabled or Chat app not configured");
        (error as any).isNotFoundError = true;
        throw error;
      }

      console.warn('Could not fetch Google Chat members:', errorText);
      throw new Error(errorData?.error?.message || errorText);
    }

    const data = await response.json();
    const members: SpaceMember[] = [];

    if (data.memberships) {
      data.memberships.forEach((membership: GoogleChatMember) => {
        if (membership.member?.email) {
          const userId = membership.member.name?.split('/').pop();
          members.push({
            email: membership.member.email,
            displayName: membership.member.displayName || membership.member.email.split('@')[0],
            userId: userId,
          });
        }
      });
    }

    return members;
  } catch (error) {
    console.error('Error fetching Google Chat members:', error);
    return [];
  }
}

// Fetch Google Chat space members
// Note: This requires OAuth2 access token, not Firebase ID token or API keys.
// We'll gracefully fall back to email mentions if this fails.
export async function fetchGoogleChatMembers(webhookUrl: string, accessToken?: string): Promise<Map<string, string>> {
  const spaceName = extractSpaceName(webhookUrl);
  if (!spaceName) {
    console.warn('Could not extract space name from webhook URL');
    return new Map();
  }

  try {
    const response = await fetch('/api/google-chat/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhookUrl, accessToken }),
    });

    if (!response.ok) {
      // Google Chat API requires OAuth2, not API keys
      // This is expected - we'll fall back to email mentions
      const errorText = await response.text();
      console.warn('Could not fetch Google Chat members (OAuth2 required). Falling back to email mentions:', errorText);
      return new Map();
    }

    const data = await response.json();
    const emailToUserIdMap = new Map<string, string>();

    // Process members and create email -> userId mapping
    if (data.memberships) {
      data.memberships.forEach((membership: GoogleChatMember) => {
        if (membership.member?.email && membership.member?.name) {
          // Extract user ID from member name (format: users/{userId})
          const userId = membership.member.name.split('/').pop();
          if (userId) {
            emailToUserIdMap.set(membership.member.email.toLowerCase(), userId);
          }
        }
      });
    }

    return emailToUserIdMap;
  } catch (error) {
    console.error('Error fetching Google Chat members:', error);
    return new Map();
  }
}

export async function sendGoogleChatNotification(webhookUrl: string, message: string) {
  if (!webhookUrl) return;

  try {
    // If the input is a full URL, use it directly.
    // Otherwise, assume it's an API key (backward compatibility or user error) and construct the URL.
    let url = webhookUrl;
    if (!webhookUrl.startsWith("http")) {
      // Fallback for old API key input, though user is now instructed to input full URL.
      // We'll assume a default space if they only provide a key, but this is risky.
      // Better to just trust the input is a URL as requested.
      console.warn("Invalid webhook URL provided. It should start with http.");
      return;
    }

    // We'll send via our proxy to avoid CORS if needed, but server-side we can call directly.
    // Since this is client-side code calling our API route, we pass the webhook URL to the API route.

    await fetch("/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhookUrl,
        text: message,
      }),
    });
  } catch (error) {
    console.error("Failed to send Google Chat notification", error);
  }
}

// Cache for user ID mappings (space -> email -> userId)
const userCache = new Map<string, Map<string, string>>();
const cacheExpiry = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function formatMentions(
  emails: string[],
  allowedUsers: { email: string; googleChatUserId?: string }[] = [],
  webhookUrl?: string,
  accessToken?: string | null
): Promise<string> {
  // Google Chat webhook format supports:
  // - <users/{userId}> for user IDs (preferred)
  // - <users/{email}> for email addresses (fallback)
  // Note: Google Chat API requires OAuth2 to fetch user IDs, so we primarily rely on
  // manually entered user IDs in allowedUsers, with email fallback

  let emailToUserIdMap = new Map<string, string>();

  // First, check if we have user IDs in allowedUsers (manually entered)
  allowedUsers.forEach(user => {
    if (user.email && user.googleChatUserId) {
      emailToUserIdMap.set(user.email.toLowerCase(), user.googleChatUserId);
    }
  });

  // Try to fetch user IDs from Google Chat API (requires OAuth2, may fail)
  // This is optional - we'll gracefully fall back to email mentions if it fails
  if (webhookUrl && emailToUserIdMap.size === 0) {
    const spaceName = extractSpaceName(webhookUrl);
    if (spaceName) {
      // Check cache first
      const cacheKey = spaceName;
      const cached = userCache.get(cacheKey);
      const expiry = cacheExpiry.get(cacheKey) || 0;

      if (cached && Date.now() < expiry) {
        emailToUserIdMap = new Map([...emailToUserIdMap, ...cached]);
      } else {
        // Try to fetch from API using OAuth2 access token if available
        try {
          const fetchedMap = await fetchGoogleChatMembers(webhookUrl, accessToken || undefined);
          if (fetchedMap.size > 0) {
            userCache.set(cacheKey, fetchedMap);
            cacheExpiry.set(cacheKey, Date.now() + CACHE_DURATION);
            emailToUserIdMap = new Map([...emailToUserIdMap, ...fetchedMap]);
          }
        } catch (error) {
          // Silently fail - we'll use email mentions instead
          console.warn('Could not fetch user IDs, using email mentions:', error);
        }
      }
    }
  }

  return emails.map(email => {
    const userId = emailToUserIdMap.get(email.toLowerCase());
    if (userId) {
      return `<users/${userId}>`;
    }
    // Fallback to email format (works with webhooks)
    return `<users/${email}>`;
  }).join(' ');
}
