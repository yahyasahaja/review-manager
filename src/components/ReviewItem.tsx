import { useState } from "react";
import { Review, updateReviewStatus, markAsReviewed, markReviewAsUpdated } from "@/lib/db";
import { GlassCard } from "./ui/GlassCard";
import { GlassButton } from "./ui/GlassButton";
import { useAuth } from "@/context/AuthContext";
import { CheckCircleIcon, TrashIcon, BellIcon, ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { sendGoogleChatNotification, formatMentions } from "@/lib/googleChat";
import { getRoomUrl } from "@/lib/utils";

interface ReviewItemProps {
  review: Review;
  isOwner: boolean;
  userEmail: string;
  webhookUrl?: string;
  allowedUsers?: { email: string; googleChatUserId?: string }[];
  isInRoom: boolean; // Whether user is in the room (can delete)
}

export function ReviewItem({ review, isOwner, userEmail, webhookUrl, allowedUsers = [], isInRoom }: ReviewItemProps) {
  const { user, getAccessToken } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);

  // Get list of reviewers (assignees who marked as reviewed)
  const reviewers = review.assignees.filter(a => a.status === 'reviewed');
  const hasReviewers = reviewers.length > 0;

  const handleMarkDone = async () => {
    if (!confirm("Mark this review as done?")) return;
    await updateReviewStatus(review.id, "done");

    if (webhookUrl) {
      const accessToken = await getAccessToken();
      const mentions = await formatMentions(review.mentions, allowedUsers, webhookUrl, accessToken);
      const roomUrl = getRoomUrl(review.roomId);
      await sendGoogleChatNotification(
        webhookUrl,
        `✅ Review Done: ${review.title}\n${review.link}\n${mentions ? `CC: ${mentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
      );
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this review?")) return;
    await updateReviewStatus(review.id, "deleted");
  };

  const handleMarkUpdated = async () => {
    if (!hasReviewers) {
      alert("At least one person must mark this review as reviewed before you can mark it as updated.");
      return;
    }

    await markReviewAsUpdated(review.id);

    if (webhookUrl) {
      const accessToken = await getAccessToken();
      // Notify only those who reviewed it
      const reviewerEmails = reviewers.map(r => r.email);
      const mentions = await formatMentions(reviewerEmails, allowedUsers, webhookUrl, accessToken);
      const roomUrl = getRoomUrl(review.roomId);
      await sendGoogleChatNotification(
        webhookUrl,
        `🔄 Review Updated: ${review.title}\n${review.link}\n${mentions ? `CC: ${mentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
      );
    }
  };

  const handlePing = async () => {
    if (webhookUrl) {
      const accessToken = await getAccessToken();
      const mentions = await formatMentions(review.mentions, allowedUsers, webhookUrl, accessToken);
      const roomUrl = getRoomUrl(review.roomId);
      await sendGoogleChatNotification(
        webhookUrl,
        `🔔 Ping: ${review.title}\n${review.link}\n${mentions ? `CC: ${mentions}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
      );
      alert("Ping sent to Google Chat!");
    } else {
      alert("No Google Chat Webhook URL configured for this room.");
    }
  };

  const handleMarkReviewed = async () => {
    if (!user?.email) return;
    await markAsReviewed(review.id, user.email);
  };

  const isAssigned = review.assignees.some(a => a.email === userEmail);
  const myStatus = review.assignees.find(a => a.email === userEmail)?.status;
  const isReviewer = isAssigned && myStatus === 'pending';

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
      className="mb-3 md:mb-4 relative overflow-hidden cursor-pointer select-none"
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-2 md:gap-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-base md:text-lg font-bold mb-1 break-words">{review.title}</h3>
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
                  className={`text-xs px-2 py-0.5 md:py-1 rounded-full border ${assignee.status === 'reviewed'
                    ? 'bg-green-500/20 border-green-500/30 text-green-200'
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
        <div className={`flex flex-wrap gap-1.5 md:gap-2 transition-all duration-300 ease-in-out ${
          isActionsExpanded ? 'max-h-96 opacity-100 mt-2 md:mt-0 translate-y-0' : 'max-h-0 overflow-hidden opacity-0 mt-0 -translate-y-2'
        }`}>
          {/* Review Owner Actions */}
          {isOwner && (
            <>
              <GlassButton
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkDone();
                }}
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
    </GlassCard>
  );
}
