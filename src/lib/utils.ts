import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate the room URL for the deployed app
 * @param slug - Room slug
 * @returns Full URL to the room
 */
export function getRoomUrl(slug: string): string {
  return `https://review-queue.netlify.app/${slug}`;
}

/**
 * Format a date as relative time (e.g., "2 days ago", "3 hours ago", "5 minutes ago")
 * @param date - Date to format
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Format a date as detailed relative time (e.g., "3d 5h 10m", "10h 3m", "20m")
 * @param date - Date to format
 * @returns Formatted detailed relative time string
 */
export function formatDetailedTime(date: Date | null | undefined): string {
  if (!date) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const remainingHours = diffHours % 24;
  const remainingMinutes = diffMinutes % 60;

  const parts: string[] = [];

  if (diffDays > 0) {
    parts.push(`${diffDays}d`);
  }
  if (remainingHours > 0) {
    parts.push(`${remainingHours}h`);
  }
  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(`${remainingMinutes}m`);
  }

  return parts.join(' ');
}

/**
 * Format time since a date with unit (e.g., "3 days since last update")
 * @param date - Date to calculate time since
 * @param label - Label to append (e.g., "since last update", "since created")
 * @returns Formatted string with detailed time and label
 */
export function formatTimeSince(date: Date | null | undefined, label: string): string {
  if (!date) return `Unknown ${label}`;
  const detailedTime = formatDetailedTime(date);
  return `${detailedTime} ${label}`;
}

/**
 * Format a date as exact date and time (e.g., "Jan 15, 2024, 3:45 PM")
 * @param date - Date to format
 * @returns Formatted exact date and time string
 */
export function formatExactDateTime(date: Date | null | undefined): string {
  if (!date) return "Unknown";

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Validate if a string is a valid URL
 * @param url - URL string to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;

  try {
    // Try to create a URL object - this will throw if invalid
    const urlObj = new URL(url);
    // Check if it has http or https protocol
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If URL constructor throws, try adding https:// prefix
    try {
      const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `https://${url}`;
      const urlObj = new URL(urlWithProtocol);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

/**
 * Normalize URL by adding protocol if missing
 * @param url - URL string to normalize
 * @returns URL with protocol
 */
export function normalizeUrl(url: string): string {
  if (!url || !url.trim()) return url;

  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Generate a review list summary for chat notification
 * @param reviews - Array of reviews to summarize
 * @param roomUrl - URL to the review room
 * @param reviewMentionsMap - Map of review IDs to their formatted mention strings
 * @returns Formatted summary string
 */
export function generateReviewSummary(
  reviews: Array<{ id: string; title: string; link: string; createdAt?: { toDate: () => Date } | null; updatedAt?: { toDate: () => Date } | null; assignees: Array<{ email: string; status: string }>; createdBy: string }>,
  roomUrl: string,
  reviewMentionsMap?: Map<string, string>
): string {
  if (reviews.length === 0) {
    return `📋 *Review List Summary*\n\nNo active reviews at this time.\n\n📋 View in Review Queue: ${roomUrl}`;
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  let summary = `📋 *Review List Summary*\n*Total: ${reviews.length} active review${reviews.length > 1 ? 's' : ''}*\n\n`;

  reviews.forEach((review, index) => {
    const createdAt = review.createdAt?.toDate ? review.createdAt.toDate() : null;
    const updatedAt = review.updatedAt?.toDate ? review.updatedAt.toDate() : null;

    // Calculate time information
    const timeSinceCreated = createdAt ? formatDetailedTime(createdAt) : 'Unknown';
    const timeSinceUpdated = updatedAt ? formatDetailedTime(updatedAt) : 'Unknown';

    // Check for stuck flags
    const isStuckUpdate = updatedAt && updatedAt <= oneDayAgo;
    const isStuckCreated = createdAt && createdAt <= threeDaysAgo;

    // Get reviewers
    const reviewers = review.assignees.filter(a => a.status === 'reviewed');
    const pendingReviewers = review.assignees.filter(a => a.status === 'pending');
    const reviewedCount = reviewers.length;
    const totalAssignees = review.assignees.length;

    // Build review entry
    summary += `${index + 1}. *${review.title}*\n`;
    summary += `   *ID:* \`${review.id}\`\n`;
    summary += `   🔗 ${review.link}\n`;

    // Time information with flags - combined in one line
    const timeParts: string[] = [];
    if (isStuckCreated) {
      timeParts.push(`🚨 *STUCK ${timeSinceCreated} since created*`);
    } else if (createdAt) {
      const isOldCreated = createdAt <= threeDaysAgo;
      if (isOldCreated) {
        timeParts.push(`🚨 *Created: ${timeSinceCreated} ago (OVERDUE)*`);
      } else {
        timeParts.push(`📅 *Created:* _${timeSinceCreated} ago_`);
      }
    }

    if (isStuckUpdate) {
      timeParts.push(`⚠️ *STUCK ${timeSinceUpdated} since last update*`);
    } else if (updatedAt) {
      const isOldUpdated = updatedAt <= oneDayAgo;
      if (isOldUpdated) {
        timeParts.push(`⚠️ *Updated: ${timeSinceUpdated} ago (OVERDUE)*`);
      } else {
        timeParts.push(`🔄 *Updated:* _${timeSinceUpdated} ago_`);
      }
    }

    if (timeParts.length > 0) {
      summary += `   ${timeParts.join(' | ')}\n`;
    }

    // Owner information
    summary += `   👤 *Owner:* _${review.createdBy.split('@')[0]}_\n`;

    // Reviewers status
    if (totalAssignees > 0) {
      summary += `   👥 *Reviewers:* ${reviewedCount}/${totalAssignees} reviewed`;
      if (reviewedCount > 0) {
        const reviewerNames = reviewers.map(r => r.email.split('@')[0]).join(', ');
        summary += ` (_${reviewerNames}_)`;
      }
      if (pendingReviewers.length > 0) {
        const pendingNames = pendingReviewers.map(r => r.email.split('@')[0]).join(', ');
        summary += ` | ${pendingReviewers.length} pending (_${pendingNames}_)`;
      }
      summary += `\n`;

      // Add mentions for this review's assignees (pending reviewers and owner)
      if (reviewMentionsMap && reviewMentionsMap.has(review.id)) {
        const mentions = reviewMentionsMap.get(review.id);
        if (mentions) {
          summary += `   📢 *Notifying Owner & Pending Reviewers:*\n   ${mentions}\n`;
      }
    }
    }

    summary += `\n`;
  });

  summary += `📋 View in Review Queue: ${roomUrl}`;

  return summary;
}

