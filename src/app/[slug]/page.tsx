"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRoom, Room, Review } from "@/lib/db";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { AddReviewForm } from "@/components/AddReviewForm";
import { ReviewItem } from "@/components/ReviewItem";
import { RoomSettings } from "@/components/RoomSettings";
import { ChevronDownIcon, ChevronUpIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { sendGoogleChatNotification, formatMentions } from "@/lib/googleChat";
import { getRoomUrl, generateReviewSummary } from "@/lib/utils";

function SendSummaryButton({ reviews, room, getAccessToken }: { reviews: Review[]; room: Room; getAccessToken: () => Promise<string | null> }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <GlassButton
      onClick={async () => {
        if (isLoading) return; // Idempotent check
        setIsLoading(true);
        try {
          const accessToken = await getAccessToken();
          const roomUrl = getRoomUrl(room.slug);

          // Format mentions for each review - separate owner, reviewers, and pending reviewers
          const reviewMentionsData = new Map<string, {
            ownerMention: string;
            reviewersMention: string;
            pendingMention: string;
          }>();

          for (const review of reviews) {
            const reviewedReviewers = review.assignees.filter(a => a.status === 'reviewed');
            const pendingReviewers = review.assignees.filter(a => a.status === 'pending');

            const ownerMention = await formatMentions([review.createdBy], room.allowedUsers, room.webhookUrl, accessToken);
            const reviewersMention = reviewedReviewers.length > 0
              ? await formatMentions(reviewedReviewers.map(r => r.email), room.allowedUsers, room.webhookUrl, accessToken)
              : '';
            const pendingMention = pendingReviewers.length > 0
              ? await formatMentions(pendingReviewers.map(r => r.email), room.allowedUsers, room.webhookUrl, accessToken)
              : '';

            reviewMentionsData.set(review.id, {
              ownerMention,
              reviewersMention,
              pendingMention
            });
          }

          const summary = generateReviewSummary(reviews, roomUrl, reviewMentionsData);

          await sendGoogleChatNotification(room.webhookUrl, summary);
          alert("Review summary sent to Google Chat!");
        } catch (error) {
          console.error("Error sending summary:", error);
          alert("Error sending summary to Google Chat");
        } finally {
          setIsLoading(false);
        }
      }}
      isLoading={isLoading}
      className="w-full flex items-center justify-center gap-2 px-4! py-2.5! text-sm md:text-base"
    >
      <DocumentTextIcon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
      <span className="hidden sm:inline">Send Review List Summary to Chat</span>
      <span className="sm:hidden">Send Summary</span>
    </GlassButton>
  );
}

export default function RoomPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreatedSectionExpanded, setIsCreatedSectionExpanded] = useState(true);
  const [isUpdatedSectionExpanded, setIsUpdatedSectionExpanded] = useState(true);
  const [isAllSectionExpanded, setIsAllSectionExpanded] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "forYou" | "createdByYou">("all");

  useEffect(() => {
    if (authLoading) return;

    // If not logged in, redirect to home with return URL
    if (!user) {
      router.push(`/?returnTo=${encodeURIComponent(slug)}`);
      return;
    }

    const fetchRoom = async () => {
      try {
        const roomData = await getRoom(slug);
        if (!roomData) {
          setError("Room not found");
          setLoading(false);
          return;
        }

        // Check access
        const isAllowed = roomData.allowedUsers.some(u => u.email === user.email) || roomData.createdBy === user.email;
        if (!isAllowed) {
          setError("You are not allowed in this room");
          setLoading(false);
          return;
        }

        setRoom(roomData);
        setLoading(false);

        if (!db) {
          setError("Database not initialized");
          setLoading(false);
          return;
        }

        // Subscribe to reviews
        const reviewsRef = collection(db, "reviews");
        const q = query(
          reviewsRef,
          where("roomId", "==", slug),
          where("status", "==", "active"),
          orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const reviewsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Review));
          setReviews(reviewsData);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error(err);
        setError("Error loading room");
        setLoading(false);
      }
    };

    fetchRoom();
  }, [slug, user, authLoading, router]);

  const forYouReviews = useMemo(() => {
    return reviews.filter(r => r.assignees.some(a => a.email === user?.email));
  }, [reviews, user]);

  const createdByYouReviews = useMemo(() => {
    return reviews.filter(r => r.createdBy === user?.email);
  }, [reviews, user]);

  const filteredReviews = useMemo(() => {
    switch (selectedFilter) {
      case "forYou": return forYouReviews;
      case "createdByYou": return createdByYouReviews;
      default: return reviews;
    }
  }, [reviews, selectedFilter, forYouReviews, createdByYouReviews]);

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show errors (including unauthorized access)
  if (error) {
    const isUnauthorized = error.includes("not allowed") || error.includes("unauthorized");
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <GlassCard className="max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">{isUnauthorized ? "🚫" : "⚠️"}</div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {isUnauthorized ? "Access Denied" : "Error"}
            </h1>
            <p className="text-white/70 mb-6">
              {error}
              {isUnauthorized && (
                <span className="block mt-2 text-sm">
                  Please contact the room creator to be added to the allowed users list.
                </span>
              )}
            </p>
            <div className="space-y-3">
              <GlassButton
                onClick={() => router.push('/')}
                className="w-full"
              >
                Go to Home
              </GlassButton>
              {isUnauthorized && (
                <GlassButton
                  variant="ghost"
                  onClick={() => router.back()}
                  className="w-full"
                >
                  Go Back
                </GlassButton>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!room) return null;

  // Filter Reviews
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const createdMoreThan3Days = reviews.filter(r => {
    const createdAt = r.createdAt?.toDate();
    return createdAt && createdAt <= threeDaysAgo;
  });
  const updatedMoreThan1Day = reviews.filter(r => {
    const updatedAt = r.updatedAt?.toDate();
    return updatedAt && updatedAt <= oneDayAgo;
  });

  return (
    <main className="min-h-screen p-3 md:p-8 pb-24">
      <div className="max-w-4xl mx-auto">
        <header className="mb-4 md:mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2 break-words">{room.name}</h1>
              <p className="text-white/50 text-xs md:text-sm break-all">Room ID: {room.slug}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <span className="text-xs md:text-sm text-white/70 break-all">{user?.email}</span>
              <GlassButton
                variant="ghost"
                onClick={() => router.push('/')}
                className="px-3! py-2! text-xs md:text-sm"
              >
                Exit Room
              </GlassButton>
            </div>
          </div>
        </header>

        <RoomSettings room={room} onUpdate={async () => {
          const updatedRoom = await getRoom(slug);
          if (updatedRoom) {
            setRoom(updatedRoom);
          }
        }} />

        <AddReviewForm room={room} />

        {/* Send Summary Button */}
        {room.webhookUrl && reviews.length > 0 && (
          <GlassCard className="mb-6">
            <SendSummaryButton
              reviews={reviews}
              room={room}
              getAccessToken={getAccessToken}
            />
          </GlassCard>
        )}

        <div className="space-y-6 md:space-y-8">
          {createdMoreThan3Days.length > 0 && (
            <section>
              <button
                onClick={() => setIsCreatedSectionExpanded(!isCreatedSectionExpanded)}
                className="w-full flex items-center justify-between text-left mb-3 md:mb-4 pl-2 border-l-4 border-green-400 hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors"
              >
                <h2 className="text-lg md:text-xl font-semibold text-white">
                  Pending review more than 3 days created
                  <span className="text-sm font-normal text-white/50 ml-2">({createdMoreThan3Days.length})</span>
                </h2>
                {isCreatedSectionExpanded ? (
                  <ChevronUpIcon className="w-5 h-5 text-white/50 shrink-0 ml-2" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-white/50 shrink-0 ml-2" />
                )}
              </button>
              <div className={`transition-all duration-300 ease-in-out ${
                isCreatedSectionExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 overflow-hidden opacity-0'
              }`}>
                {createdMoreThan3Days.map(review => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    isOwner={review.createdBy === user?.email}
                    userEmail={user?.email || ""}
                    webhookUrl={room.webhookUrl}
                    allowedUsers={room.allowedUsers}
                    isInRoom={room.allowedUsers.some(u => u.email === user?.email) || room.createdBy === user?.email}
                  />
                ))}
              </div>
            </section>
          )}

          {updatedMoreThan1Day.length > 0 && (
            <section>
              <button
                onClick={() => setIsUpdatedSectionExpanded(!isUpdatedSectionExpanded)}
                className="w-full flex items-center justify-between text-left mb-3 md:mb-4 pl-2 border-l-4 border-blue-400 hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors"
              >
                <h2 className="text-lg md:text-xl font-semibold text-white">
                  Pending review more than 1 day since last updated
                  <span className="text-sm font-normal text-white/50 ml-2">({updatedMoreThan1Day.length})</span>
                </h2>
                {isUpdatedSectionExpanded ? (
                  <ChevronUpIcon className="w-5 h-5 text-white/50 shrink-0 ml-2" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-white/50 shrink-0 ml-2" />
                )}
              </button>
              <div className={`transition-all duration-300 ease-in-out ${
                isUpdatedSectionExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 overflow-hidden opacity-0'
              }`}>
                {updatedMoreThan1Day.map(review => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    isOwner={review.createdBy === user?.email}
                    userEmail={user?.email || ""}
                    webhookUrl={room.webhookUrl}
                    allowedUsers={room.allowedUsers}
                    isInRoom={room.allowedUsers.some(u => u.email === user?.email) || room.createdBy === user?.email}
                    showUpdatedTime={true}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex gap-6">
                <button
                  onClick={() => setSelectedFilter("all")}
                  className={`px-4 text-lg md:text-xl font-semibold cursor-pointer text-white hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors ${selectedFilter === "all" ? "bg-white/5" : ""}`}
                >
                  All Active Reviews
                  <span className="text-sm font-normal text-white/50 ml-2">({reviews.length})</span>
                </button>
                <button
                  onClick={() => setSelectedFilter("forYou")}
                  className={`px-4 text-lg md:text-xl font-semibold cursor-pointer text-white hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors ${selectedFilter === "forYou" ? "bg-white/5" : ""}`}
                >
                  For You
                  <span className="text-sm font-normal text-white/50 ml-2">({forYouReviews.length})</span>
                </button>
                <button
                  onClick={() => setSelectedFilter("createdByYou")}
                  className={`px-4 text-lg md:text-xl font-semibold cursor-pointer text-white hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors ${selectedFilter === "createdByYou" ? "bg-white/5" : ""}`}
                >
                  Created by You
                  <span className="text-sm font-normal text-white/50 ml-2">({createdByYouReviews.length})</span>
                </button>
              </div>
              <button
                onClick={() => setIsAllSectionExpanded(!isAllSectionExpanded)}
                className="flex items-center justify-between text-left border-l-4 border-white/20 hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors"
              >
                {isAllSectionExpanded ? (
                  <ChevronUpIcon className="w-5 h-5 text-white/50 shrink-0" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-white/50 shrink-0" />
                )}
              </button>
            </div>
            <div className={`transition-all duration-300 ease-in-out ${
              isAllSectionExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 overflow-hidden opacity-0'
            }`}>
              {filteredReviews.length === 0 ? (
                <p className="text-white/50 italic">No active reviews.</p>
              ) : (
                filteredReviews.map(review => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    isOwner={review.createdBy === user?.email}
                    userEmail={user?.email || ""}
                    webhookUrl={room.webhookUrl}
                    allowedUsers={room.allowedUsers}
                    isInRoom={room.allowedUsers.some(u => u.email === user?.email) || room.createdBy === user?.email}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
