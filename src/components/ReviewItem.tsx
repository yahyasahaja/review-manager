import { useState } from "react";
import { Review, updateReviewStatus, markAsReviewed, markReviewAsUpdated, updateReviewAssignees } from "@/lib/db";
import { GlassCard } from "./ui/GlassCard";
import { GlassButton } from "./ui/GlassButton";
import { GlassInput } from "./ui/GlassInput";
import { useAuth } from "@/context/AuthContext";
import { CheckCircleIcon, TrashIcon, BellIcon, ArrowPathIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
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
  const [isEditingReviewers, setIsEditingReviewers] = useState(false);
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(new Set());
  const [reviewerSearchFilter, setReviewerSearchFilter] = useState("");
  const [isLoading, setIsLoading] = useState({
    markDone: false,
    markUpdated: false,
    ping: false,
    markReviewed: false,
    delete: false,
    updateReviewers: false,
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
        const roomUrl = getRoomUrl(review.roomId);

        // Get reviewers info
        const reviewers = review.assignees.filter(a => a.status === 'reviewed');
        const reviewersInfo = reviewers.length > 0
          ? `\n👥 Reviewers: ${reviewers.map(r => r.email.split('@')[0]).join(', ')} (${reviewers.length} reviewed)`
          : '';

        // Notify owner and reviewers
        const notifyEmails = [...new Set([review.createdBy, ...reviewers.map(r => r.email)])];
        const mentions = await formatMentions(notifyEmails, allowedUsers, webhookUrl, accessToken);

        let notificationMessage = `✅ *Review Done:* _${review.title}_\n*ID:* \`${review.id}\`\n🔗 ${review.link}\n👤 *Owner:* _${review.createdBy.split('@')[0]}_${reviewersInfo}\n`;

        if (mentions) {
          notificationMessage += `\n📢 *Notifying:*\n${mentions}\n`;
        }

        notificationMessage += `\n📋 View in Review Queue: ${roomUrl}`;

        await sendGoogleChatNotification(webhookUrl, notificationMessage);
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
        const roomUrl = getRoomUrl(review.roomId);

        // Get reviewers info - these are the reviewers who had reviewed before the update
        // (they will be reset to pending after markReviewAsUpdated is called)
        const reviewersInfo = reviewers.length > 0
          ? `\n👥 *Reviewers:* ${reviewers.map(r => r.email.split('@')[0]).join(', ')} (${reviewers.length} reviewed)`
          : '';

        // Notify those who reviewed it AND the review creator
        const reviewerEmails = reviewers.map(r => r.email);
        const allMentions = [...new Set([...reviewerEmails, review.createdBy])];
        const mentions = await formatMentions(allMentions, allowedUsers, webhookUrl, accessToken);

        let notificationMessage = `🔄 *Review Updated:* _${review.title}_\n*ID:* \`${review.id}\`\n🔗 ${review.link}\n👤 *Owner:* _${review.createdBy.split('@')[0]}_${reviewersInfo}\n`;

        if (mentions) {
          notificationMessage += `\n📢 *Notifying Owner & Reviewers:*\n${mentions}\n`;
        }

        notificationMessage += `\n📋 View in Review Queue: ${roomUrl}`;

        await sendGoogleChatNotification(webhookUrl, notificationMessage);
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

      // Get reviewers info
      const reviewers = review.assignees.filter(a => a.status === 'reviewed');
      const pendingReviewers = review.assignees.filter(a => a.status === 'pending');
      const reviewersInfo = reviewers.length > 0
        ? `\n👥 Reviewers: ${reviewers.map(r => r.email.split('@')[0]).join(', ')} (${reviewers.length} reviewed)`
        : '';
      const pendingInfo = pendingReviewers.length > 0
        ? `\n⏳ Pending Reviewers: ${pendingReviewers.map(r => r.email.split('@')[0]).join(', ')} (${pendingReviewers.length})`
        : '';

      // Notify pending reviewers, owner, and any additional mentions
      const notifyEmails = [...new Set([
        ...pendingReviewers.map(r => r.email),
        review.createdBy,
        ...(review.mentions || [])
      ])];
      const mentions = await formatMentions(notifyEmails, allowedUsers, webhookUrl, accessToken);

      let notificationMessage = `🔔 *Ping:* _${review.title}_\n*ID:* \`${review.id}\`\n🔗 ${review.link}\n👤 *Owner:* _${review.createdBy.split('@')[0]}_${reviewersInfo}${pendingInfo}${stuckInfoText}`;

      if (mentions) {
        notificationMessage += `\n📢 *Notifying Owner & Pending Reviewers:*\n${mentions}\n`;
      }

      notificationMessage += `\n📋 View in Review Queue: ${roomUrl}`;

      await sendGoogleChatNotification(webhookUrl, notificationMessage);
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
        const roomUrl = getRoomUrl(review.roomId);

        // Get all reviewers info
        const allReviewers = review.assignees.filter(a => a.status === 'reviewed');
        const reviewersInfo = allReviewers.length > 0
          ? `\n👥 Reviewers: ${allReviewers.map(r => r.email.split('@')[0]).join(', ')} (${allReviewers.length} reviewed)`
          : '';

        // Notify the owner
        const ownerMentions = await formatMentions([review.createdBy], allowedUsers, webhookUrl, accessToken);

        let notificationMessage = `✅ *Review Marked as Reviewed:* _${review.title}_\n*ID:* \`${review.id}\`\n🔗 ${review.link}\n👤 *Owner:* _${review.createdBy.split('@')[0]}_\n✅ *Reviewed by:* _${user.email.split('@')[0]}_${reviewersInfo}\n`;

        if (ownerMentions) {
          notificationMessage += `\n📢 *Notifying Owner:*\n${ownerMentions}\n`;
        }

        notificationMessage += `\n📋 View in Review Queue: ${roomUrl}`;

        await sendGoogleChatNotification(webhookUrl, notificationMessage);
      }
    } finally {
      setIsLoading(prev => ({ ...prev, markReviewed: false }));
    }
  };

  const handleStartEditReviewers = () => {
    // Initialize selected reviewers with current assignees
    const currentAssignees = new Set(review.assignees.map(a => a.email));
    setSelectedReviewers(currentAssignees);
    setReviewerSearchFilter("");
    setIsEditingReviewers(true);
  };

  const handleCancelEditReviewers = () => {
    setIsEditingReviewers(false);
    setSelectedReviewers(new Set());
    setReviewerSearchFilter("");
  };

  const handleToggleReviewer = (email: string) => {
    const newSelected = new Set(selectedReviewers);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedReviewers(newSelected);
  };

  const handleSaveReviewers = async () => {
    if (isLoading.updateReviewers) return;

    // Build new assignees list - preserve status for existing reviewers, set new ones to pending
    const existingAssigneesMap = new Map(
      review.assignees.map(a => [a.email, a.status])
    );

    const newAssignees = Array.from(selectedReviewers).map(email => ({
      email,
      status: (existingAssigneesMap.get(email) || 'pending') as 'pending' | 'reviewed'
    }));

    // Get lists of reviewers for notification
    const newReviewers = newAssignees.filter(a => a.status === 'reviewed');
    const pendingReviewers = newAssignees.filter(a => a.status === 'pending');
    const addedReviewers = newAssignees.filter(a => !review.assignees.some(existing => existing.email === a.email));
    const removedReviewers = review.assignees.filter(existing => !newAssignees.some(newA => newA.email === existing.email));

    setIsLoading(prev => ({ ...prev, updateReviewers: true }));
    try {
      await updateReviewAssignees(review.id, newAssignees);

      // Send notification if webhook is configured
      if (webhookUrl) {
        const accessToken = await getAccessToken();
        const roomUrl = getRoomUrl(review.roomId);

        // Build notification message
        let notificationMessage = `📝 *Reviewers Updated:* _${review.title}_\n*ID:* \`${review.id}\`\n🔗 ${review.link}\n👤 *Owner:* _${review.createdBy.split('@')[0]}_\n`;

        // Reviewers info
        if (newReviewers.length > 0) {
          notificationMessage += `👥 *Reviewers:* _${newReviewers.map(r => r.email.split('@')[0]).join(', ')}_ (${newReviewers.length} reviewed)\n`;
        }
        if (pendingReviewers.length > 0) {
          notificationMessage += `⏳ *Pending:* _${pendingReviewers.map(r => r.email.split('@')[0]).join(', ')}_ (${pendingReviewers.length})\n`;
        }

        // Changes summary
        if (addedReviewers.length > 0) {
          notificationMessage += `➕ *Added:* _${addedReviewers.map(r => r.email.split('@')[0]).join(', ')}_\n`;
        }
        if (removedReviewers.length > 0) {
          notificationMessage += `➖ *Removed:* _${removedReviewers.map(r => r.email.split('@')[0]).join(', ')}_\n`;
        }

        // Mention newly added reviewers and the owner
        const mentionsToNotify = [...new Set([
          ...addedReviewers.map(r => r.email),
          review.createdBy
        ])];
        const mentions = await formatMentions(mentionsToNotify, allowedUsers, webhookUrl, accessToken);
        if (mentions) {
          notificationMessage += `\n📢 *Notifying Owner & Newly Added Reviewers:*\n${mentions}\n`;
        }

        notificationMessage += `\n📋 View in Review Queue: ${roomUrl}`;

        await sendGoogleChatNotification(webhookUrl, notificationMessage);
      }

      setIsEditingReviewers(false);
      setSelectedReviewers(new Set());
      setReviewerSearchFilter("");
    } catch (error) {
      console.error("Error updating reviewers:", error);
      alert("Error updating reviewers: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsLoading(prev => ({ ...prev, updateReviewers: false }));
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

            {/* Owner information */}
            <div className="mt-1.5 md:mt-2">
              <span className="text-xs text-white/50">
                Owner: <span className="text-white/70 font-medium">{review.createdBy.split('@')[0]}</span>
              </span>
            </div>

            {/* Reviewers section */}
            {!isEditingReviewers ? (
              <>
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
                {/* Edit button - show for owners or people in room */}
                {(isOwner || isInRoom) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditReviewers();
                    }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <PencilIcon className="w-3 h-3" />
                    Edit Reviewers
                  </button>
                )}
              </>
            ) : (
              <div className="mt-2 md:mt-3 space-y-2">
                <div className="text-xs text-white/70 mb-2">Select Reviewers:</div>
                {/* Search input */}
                <GlassInput
                  type="text"
                  placeholder="Search by name or email..."
                  value={reviewerSearchFilter}
                  onChange={(e) => {
                    e.stopPropagation();
                    setReviewerSearchFilter(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-sm"
                />
                <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  {(() => {
                    // Include owner in the list if not already in allowedUsers
                    const ownerInList = allowedUsers.some(u => u.email === review.createdBy);
                    const allSelectableUsers = ownerInList
                      ? allowedUsers
                      : [...allowedUsers, { email: review.createdBy, googleChatUserId: undefined }];

                    // Filter users based on search term
                    const searchTerm = reviewerSearchFilter.toLowerCase().trim();
                    const filteredUsers = searchTerm
                      ? allSelectableUsers.filter(user => {
                          const name = user.email.split('@')[0].toLowerCase();
                          const email = user.email.toLowerCase();
                          return name.includes(searchTerm) || email.includes(searchTerm);
                        })
                      : allSelectableUsers;

                    if (allSelectableUsers.length === 0) {
                      return <div className="text-xs text-white/50 italic">No users available</div>;
                    }

                    if (filteredUsers.length === 0) {
                      return <div className="text-xs text-white/50 italic">No users match "{reviewerSearchFilter}"</div>;
                    }

                    return filteredUsers.map((user) => {
                      const isSelected = selectedReviewers.has(user.email);
                      const existingAssignee = review.assignees.find(a => a.email === user.email);
                      const isReviewed = existingAssignee?.status === 'reviewed';
                      const isOwner = user.email === review.createdBy;

                      return (
                        <label
                          key={user.email}
                          className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleReviewer(user.email)}
                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white">
                              {user.email.split('@')[0]}
                              {isOwner && <span className="text-xs text-blue-400 ml-1">(Owner)</span>}
                            </div>
                            <div className="text-xs text-white/60 truncate">{user.email}</div>
                          </div>
                          {isReviewed && (
                            <span className="text-xs text-green-400">Reviewed</span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
                <div className="flex gap-2">
                  <GlassButton
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelEditReviewers();
                    }}
                    className="flex-1 text-xs px-3! py-2!"
                  >
                    <XMarkIcon className="w-3.5 h-3.5 mr-1" />
                    Cancel
                  </GlassButton>
                  <GlassButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveReviewers();
                    }}
                    isLoading={isLoading.updateReviewers}
                    className="flex-1 text-xs px-3! py-2!"
                  >
                    <CheckIcon className="w-3.5 h-3.5 mr-1" />
                    Save
                  </GlassButton>
                </div>
              </div>
            )}

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
