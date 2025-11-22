import { useState } from "react";
import { Review, updateReviewStatus, markAsReviewed, markReviewAsUpdated } from "@/lib/db";
import { GlassCard } from "./ui/GlassCard";
import { GlassButton } from "./ui/GlassButton";
import { useAuth } from "@/context/AuthContext";
import { CheckCircleIcon, TrashIcon, BellIcon, ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { sendGoogleChatNotification, formatMentions } from "@/lib/googleChat";
import { getRoomUrl, formatRelativeTime, formatDetailedTime, formatTimeSince, formatExactDateTime } from "@/lib/utils";

interface ReviewItemProps {
  review: Review;
  isOwner: boolean;
  userEmail: string;
  webhookUrl?: string;
  allowedUsers?: { email: string; googleChatUserId?: string }[];
  isInRoom: boolean; // Whether user is in the room (can delete)
  showUpdatedTime?: boolean; // If true, show time since last update instead of creation
}

export function ReviewItem({ review, isOwner, userEmail, webhookUrl, allowedUsers = [], isInRoom, showUpdatedTime = false }: ReviewItemProps) {
  const { user, getAccessToken } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState({
    markDone: false,
    markUpdated: false,
    ping: false,
    markReviewed: false,
    delete: false,
  });

  // Get list of reviewers (assignees who marked as reviewed)
  const reviewers = review.assignees.filter(a => a.status === 'reviewed');
  const hasReviewers = reviewers.length > 0;

  const handleMarkDone = async () => {
    if (isLoading.markDone) return; // Idempotent check
    if (!confirm("Mark this review as done?")) return;

    setIsLoading(prev => ({ ...prev, markDone: true }));
    try {
      await updateReviewStatus(review.id, "done");

      if (webhookUrl) {
        const accessToken = await getAccessToken();
        const mentions = await formatMentions(review.mentions, allowedUsers, webhookUrl, accessToken);
        const roomUrl = getRoomUrl(review.roomId);
        await sendGoogleChatNotification(
          webhookUrl,
          `✅ Review Done: ${review.title}\nID: ${review.id}\n${review.link}\n${mentions ? `\nCC: ${mentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
        );
      }
    } finally {
      setIsLoading(prev => ({ ...prev, markDone: false }));
    }
  };

  const handleDelete = async () => {
    if (isLoading.delete) return; // Idempotent check
    if (!confirm("Delete this review?")) return;

    setIsLoading(prev => ({ ...prev, delete: true }));
    try {
      await updateReviewStatus(review.id, "deleted");
    } finally {
      setIsLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleMarkUpdated = async () => {
    if (isLoading.markUpdated) return; // Idempotent check
    if (!hasReviewers) {
      alert("At least one person must mark this review as reviewed before you can mark it as updated.");
      return;
    }

    setIsLoading(prev => ({ ...prev, markUpdated: true }));
    try {
      await markReviewAsUpdated(review.id);

      if (webhookUrl) {
        const accessToken = await getAccessToken();
        // Notify those who reviewed it AND the review creator
        const reviewerEmails = reviewers.map(r => r.email);
        const allMentions = [...new Set([...reviewerEmails, review.createdBy])];
        const mentions = await formatMentions(allMentions, allowedUsers, webhookUrl, accessToken);
        const roomUrl = getRoomUrl(review.roomId);
        await sendGoogleChatNotification(
          webhookUrl,
          `🔄 Review Updated: ${review.title}\nID: ${review.id}\n${review.link}\n${mentions ? `\nCC: ${mentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
        );
      }
    } finally {
      setIsLoading(prev => ({ ...prev, markUpdated: false }));
    }
  };

  const handlePing = async () => {
    if (isLoading.ping) return; // Idempotent check
    if (!webhookUrl) {
      alert("No Google Chat Webhook URL configured for this room.");
      return;
    }

    setIsLoading(prev => ({ ...prev, ping: true }));
    try {
      const accessToken = await getAccessToken();
      const mentions = await formatMentions(review.mentions, allowedUsers, webhookUrl, accessToken);
      const roomUrl = getRoomUrl(review.roomId);

      // Calculate stuck time information
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const stuckInfo: string[] = [];

      // Check if stuck for more than 1 day since last update
      if (review.updatedAt) {
        const updatedAt = review.updatedAt.toDate();
        if (updatedAt <= oneDayAgo) {
          const timeSinceUpdate = formatTimeSince(updatedAt, "since last update");
          stuckInfo.push(`⚠️ *Stuck ${timeSinceUpdate}*`);
        }
      }

      // Check if stuck for more than 3 days since created
      if (review.createdAt) {
        const createdAt = review.createdAt.toDate();
        if (createdAt <= threeDaysAgo) {
          const timeSinceCreated = formatTimeSince(createdAt, "since created");
          stuckInfo.push(`🚨 *Stuck ${timeSinceCreated}*`);
        }
      }

      const stuckInfoText = stuckInfo.length > 0 ? `\n\n${stuckInfo.join('\n')}\n` : '';

      await sendGoogleChatNotification(
        webhookUrl,
        `🔔 Ping: ${review.title}\nID: ${review.id}\n${review.link}${stuckInfoText}${mentions ? `\nCC: ${mentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
      );
      alert("Ping sent to Google Chat!");
    } finally {
      setIsLoading(prev => ({ ...prev, ping: false }));
    }
  };

  const handleMarkReviewed = async () => {
    if (isLoading.markReviewed) return; // Idempotent check
    if (!user?.email) return;

    setIsLoading(prev => ({ ...prev, markReviewed: true }));
    try {
      await markAsReviewed(review.id, user.email);

      // Notify the review creator
      if (webhookUrl && review.createdBy) {
        const accessToken = await getAccessToken();
        const creatorMentions = await formatMentions([review.createdBy], allowedUsers, webhookUrl, accessToken);
        const roomUrl = getRoomUrl(review.roomId);
        await sendGoogleChatNotification(
          webhookUrl,
          `✅ Review Marked as Reviewed: ${review.title}\nID: ${review.id}\n${review.link}\nReviewed by: ${user.email}${creatorMentions ? `\nCC: ${creatorMentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
        );
      }
    } finally {
      setIsLoading(prev => ({ ...prev, markReviewed: false }));
    }
  };

  const isAssigned = review.assignees.some(a => a.email === userEmail);
  const myStatus = review.assignees.find(a => a.email === userEmail)?.status;
  const isReviewer = isAssigned && myStatus === 'pending';

  // Check if review is more than 1 day old (based on creation or update time)
  const timeToCheck = showUpdatedTime ? review.updatedAt : review.createdAt;
  const isOldReview = timeToCheck ? (() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return timeToCheck.toDate() <= oneDayAgo;
  })() : false;

  // Get the time to display
  const displayTime = showUpdatedTime ? review.updatedAt : review.createdAt;

  // Calculate time since last update for detailed display
  const timeSinceUpdate = review.updatedAt ? formatTimeSince(review.updatedAt.toDate(), "since last update") : null;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on the link or action buttons
    const target = e.target as HTMLElement;

    // Only prevent toggle if clicking directly on interactive elements
    if (
      target.closest('a[href]') || // Links
      target.closest('.action-button') || // Action buttons
      (target.tagName === 'BUTTON' && target.closest('button[onClick]')) // Buttons with click handlers
    ) {
      return;
    }

    // Toggle actions (works for both owners and assignees)
    setIsActionsExpanded(prev => !prev);
  };

  return (
    <GlassCard
      className={`mb-3 md:mb-4 relative overflow-hidden cursor-pointer select-none transition-all duration-300 ${
        isOldReview
          ? 'border-l-4 border-l-orange-400/60 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent shadow-lg shadow-orange-500/5 before:absolute before:inset-0 before:bg-gradient-to-r before:from-orange-400/5 before:via-transparent before:to-transparent before:pointer-events-none'
          : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-2 md:gap-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-bold break-words">{review.title}</h3>
                <div className="mt-0.5 text-xs text-white/40 font-mono">
                  ID: {review.id}
                </div>
              </div>
              {displayTime && (
                <span className={`text-xs whitespace-nowrap shrink-0 px-2 py-1 rounded-full backdrop-blur-sm transition-all ${
                  isOldReview
                    ? 'bg-orange-500/20 border border-orange-400/40 text-orange-200 shadow-lg shadow-orange-500/10'
                    : 'text-white/50'
                }`}>
                  {showUpdatedTime && timeSinceUpdate ? timeSinceUpdate : formatRelativeTime(displayTime.toDate())}
                </span>
              )}
            </div>
            <a
              href={review.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 text-xs md:text-sm underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {review.link}
            </a>

            <div className={`mt-2 md:mt-3 flex flex-wrap gap-1.5 md:gap-2 transition-all duration-300 ${isExpanded ? 'max-h-none' : 'max-h-8 overflow-hidden md:max-h-none'}`}>
              {review.assignees.map((assignee) => (
                <span
                  key={assignee.email}
                  className={`text-xs px-2 py-0.5 md:py-1 rounded-full border transition-all ${
                    assignee.status === 'reviewed'
                      ? 'bg-green-500/30 border-green-400/50 text-green-100 font-semibold shadow-md shadow-green-500/20 ring-1 ring-green-400/30'
                      : 'bg-white/10 border-white/20 text-white/70'
                    }`}
                >
                  {assignee.email.split('@')[0]}
                  {assignee.status === 'reviewed' && ' ✓'}
                </span>
              ))}
            </div>

            {/* Mobile expand/collapse button for assignees */}
            {review.assignees.length > 2 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="md:hidden mt-1.5 text-xs text-white/50 hover:text-white/80 flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                    Show all ({review.assignees.length})
                  </>
                )}
              </button>
            )}
          </div>

          {/* Expand/Collapse indicator */}
          {(isOwner || isReviewer || isInRoom) && (
            <div className="shrink-0 pt-1 pointer-events-none">
              {isActionsExpanded ? (
                <ChevronUpIcon className="w-4 h-4 md:w-5 md:h-5 text-white/50" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 md:w-5 md:h-5 text-white/50" />
              )}
            </div>
          )}
        </div>

        {/* Actions container - horizontal when expanded */}
        <div className={`flex flex-col gap-2 transition-all duration-300 ease-in-out ${
          isActionsExpanded ? 'max-h-96 opacity-100 mt-2 md:mt-0 translate-y-0' : 'max-h-0 overflow-hidden opacity-0 mt-0 -translate-y-2'
        }`}>
          {/* Created At and Last Updated */}
          <div className="flex flex-col gap-1 text-xs text-white/60">
            {review.createdAt && (
              <div>
                <span className="font-medium">Created At:</span> {formatExactDateTime(review.createdAt.toDate())}
              </div>
            )}
            {review.updatedAt && (
              <div>
                <span className="font-medium">Last Updated:</span> {formatExactDateTime(review.updatedAt.toDate())}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
          {/* Review Owner Actions */}
          {isOwner && (
            <>
              <GlassButton
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkDone();
                }}
                isLoading={isLoading.markDone}
                className={`action-button flex items-center gap-1.5 md:gap-2 px-3! py-2! md:px-4! md:py-2.5! transition-all duration-300 ${
                  isActionsExpanded ? 'opacity-100 translate-y-0 delay-75' : 'opacity-0 -translate-y-2'
                }`}
              >
                <CheckCircleIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-400" />
                <span className="text-xs md:text-sm">Done</span>
              </GlassButton>

              {/* Mark as Updated - only if at least 1 person reviewed */}
              {hasReviewers && (
                <GlassButton
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkUpdated();
                  }}
                  isLoading={isLoading.markUpdated}
                  className={`action-button flex items-center gap-1.5 md:gap-2 px-3! py-2! md:px-4! md:py-2.5! transition-all duration-300 ${
                    isActionsExpanded ? 'opacity-100 translate-y-0 delay-100' : 'opacity-0 -translate-y-2'
                  }`}
                  title={`Will notify: ${reviewers.map(r => r.email.split('@')[0]).join(', ')}`}
                >
                  <ArrowPathIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                  <span className="text-xs md:text-sm">Updated</span>
                  {hasReviewers && (
                    <span className="text-xs text-white/50 ml-1">
                      ({reviewers.length} reviewed)
                    </span>
                  )}
                </GlassButton>
              )}

              <GlassButton
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePing();
                }}
                isLoading={isLoading.ping}
                className={`action-button flex items-center gap-1.5 md:gap-2 px-3! py-2! md:px-4! md:py-2.5! transition-all duration-300 ${
                  isActionsExpanded ? 'opacity-100 translate-y-0 delay-150' : 'opacity-0 -translate-y-2'
                }`}
              >
                <BellIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-400" />
                <span className="text-xs md:text-sm">Ping</span>
              </GlassButton>

              <GlassButton
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                isLoading={isLoading.delete}
                className={`action-button flex items-center gap-1.5 md:gap-2 px-3! py-2! md:px-4! md:py-2.5! transition-all duration-300 ${
                  isActionsExpanded ? 'opacity-100 translate-y-0 delay-200' : 'opacity-0 -translate-y-2'
                }`}
              >
                <TrashIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm">Delete</span>
              </GlassButton>
            </>
          )}

          {/* Reviewer Actions (assignee with pending status) */}
          {!isOwner && isReviewer && (
            <>
              <GlassButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkReviewed();
                }}
                isLoading={isLoading.markReviewed}
                className={`action-button text-xs whitespace-nowrap px-3! py-2! transition-all duration-300 ${
                  isActionsExpanded ? 'opacity-100 translate-y-0 delay-75' : 'opacity-0 -translate-y-2'
                }`}
              >
                Mark Reviewed
              </GlassButton>

              <GlassButton
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                isLoading={isLoading.delete}
                className={`action-button flex items-center gap-1.5 md:gap-2 px-3! py-2! md:px-4! md:py-2.5! transition-all duration-300 ${
                  isActionsExpanded ? 'opacity-100 translate-y-0 delay-100' : 'opacity-0 -translate-y-2'
                }`}
              >
                <TrashIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm">Delete</span>
              </GlassButton>
            </>
          )}

          {/* Everyone in room can delete (if not owner and not reviewer) */}
          {!isOwner && !isReviewer && isInRoom && (
            <GlassButton
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className={`action-button flex items-center gap-1.5 md:gap-2 px-3! py-2! md:px-4! md:py-2.5! transition-all duration-300 ${
                isActionsExpanded ? 'opacity-100 translate-y-0 delay-75' : 'opacity-0 -translate-y-2'
              }`}
            >
              <TrashIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">Delete</span>
            </GlassButton>
          )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
