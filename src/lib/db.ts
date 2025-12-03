import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";

const checkDb = () => {
  if (!db) throw new Error("Firebase Firestore is not initialized. Check API keys.");
  return db;
};

/**
 * Clean allowedUsers array to remove undefined googleChatUserId fields
 * Firestore doesn't allow undefined values in documents
 */
function cleanAllowedUsers(users: { email: string; googleChatUserId?: string }[]): { email: string; googleChatUserId?: string }[] {
  return users.map(user => {
    const cleaned: { email: string; googleChatUserId?: string } = { email: user.email };
    if (user.googleChatUserId !== undefined && user.googleChatUserId !== null && user.googleChatUserId.trim() !== '') {
      cleaned.googleChatUserId = user.googleChatUserId;
    }
    return cleaned;
  });
}

/**
 * Extract email addresses from allowedUsers array for Firestore rules
 * This creates a simple string array that can be checked with hasAny()
 */
function extractAllowedUserEmails(users: { email: string; googleChatUserId?: string }[]): string[] {
  return users.map(user => user.email.toLowerCase());
}

export interface Room {
  slug: string;
  name: string;
  webhookUrl: string;
  allowedUsers: { email: string; googleChatUserId?: string }[];
  allowedUserEmails?: string[]; // Helper field for Firestore rules (array of email strings)
  createdBy: string;
  createdAt: Timestamp;
}

export interface Review {
  id: string;
  roomId: string;
  title: string;
  link: string;
  status: "active" | "done" | "deleted";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  assignees: { email: string; status: "pending" | "reviewed" }[];
  reviewedBy: string[]; // List of users who have marked as reviewed
  approvedBy: string[]; // List of users who have approved
}

export async function createRoom(data: Omit<Room, "createdAt">) {
  const firestore = checkDb();
  const roomRef = doc(firestore, "rooms", data.slug);
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    throw new Error("Room with this slug already exists");
  }

  await setDoc(roomRef, {
    ...data,
    allowedUsers: cleanAllowedUsers(data.allowedUsers),
    allowedUserEmails: extractAllowedUserEmails(data.allowedUsers),
    createdAt: serverTimestamp(),
  });
}

export async function getRoom(slug: string) {
  const firestore = checkDb();
  const roomRef = doc(firestore, "rooms", slug);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    return null;
  }

  return roomSnap.data() as Room;
}

export async function getUserRooms(userEmail: string): Promise<Room[]> {
  const firestore = checkDb();
  const roomsRef = collection(firestore, "rooms");

  // Get all rooms (security rules allow authenticated users to read)
  const querySnapshot = await getDocs(roomsRef);

  // Filter rooms where user is creator or in allowedUsers
  const rooms = querySnapshot.docs
    .map(doc => ({ slug: doc.id, ...doc.data() } as Room))
    .filter(room =>
      room.createdBy === userEmail ||
      room.allowedUsers.some(u => u.email === userEmail)
    )
    .sort((a, b) => {
      // Sort by creation date, newest first
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

  return rooms;
}

export async function updateRoom(slug: string, updates: Partial<Omit<Room, "slug" | "createdAt" | "createdBy">>) {
  const firestore = checkDb();
  const roomRef = doc(firestore, "rooms", slug);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("Room not found");
  }

  // Clean allowedUsers if it's being updated
  const cleanedUpdates = { ...updates };
  if (updates.allowedUsers) {
    cleanedUpdates.allowedUsers = cleanAllowedUsers(updates.allowedUsers);
    // Also update the helper field for Firestore rules
    cleanedUpdates.allowedUserEmails = extractAllowedUserEmails(cleanedUpdates.allowedUsers);
  }

  await updateDoc(roomRef, cleanedUpdates);
}

export async function addReview(roomId: string, data: Omit<Review, "id" | "roomId" | "createdAt" | "updatedAt" | "status" | "reviewedBy" | "approvedBy">) {
  const firestore = checkDb();
  const reviewsRef = collection(firestore, "reviews");
  const docRef = await addDoc(reviewsRef, {
    ...data,
    roomId,
    status: "active",
    reviewedBy: [], // Initialize empty array
    approvedBy: [], // Initialize empty array
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id; // Return the review ID
}

export async function getReviews(roomId: string) {
  const firestore = checkDb();
  const reviewsRef = collection(firestore, "reviews");
  const q = query(
    reviewsRef,
    where("roomId", "==", roomId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
}

export async function updateReviewStatus(reviewId: string, status: "done" | "deleted") {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);

  // Get the review to find its roomId
  const reviewSnap = await getDoc(reviewRef);
  if (!reviewSnap.exists()) {
    throw new Error("Review not found");
  }

  const review = reviewSnap.data() as Review;

  await updateDoc(reviewRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  // If deleting, manage the deleted items queue (max 10 items)
  if (status === "deleted") {
    await manageDeletedReviewsQueue(review.roomId);
  }

  // If marking as done, manage the done items queue (max 10 items)
  if (status === "done") {
    await manageDoneReviewsQueue(review.roomId);
  }
}

/**
 * Manage deleted reviews queue - keep max 10 deleted items, permanently delete older ones
 */
async function manageDeletedReviewsQueue(roomId: string) {
  const firestore = checkDb();
  const reviewsRef = collection(firestore, "reviews");

  // Get all deleted reviews for this room, ordered by updatedAt (oldest first)
  const q = query(
    reviewsRef,
    where("roomId", "==", roomId),
    where("status", "==", "deleted"),
    orderBy("updatedAt", "asc")
  );

  const querySnapshot = await getDocs(q);
  const deletedReviews = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Review & { id: string }));

  // If more than 10 deleted items, permanently delete the oldest ones
  if (deletedReviews.length > 10) {
    const toDelete = deletedReviews.slice(0, deletedReviews.length - 10);

    // Permanently delete the oldest deleted reviews
    const deletePromises = toDelete.map(review => {
      const reviewRef = doc(firestore, "reviews", review.id);
      return deleteDoc(reviewRef);
    });

    await Promise.all(deletePromises);
  }
}

/**
 * Manage done reviews queue - keep max 10 done items, permanently delete older ones
 */
async function manageDoneReviewsQueue(roomId: string) {
  const firestore = checkDb();
  const reviewsRef = collection(firestore, "reviews");

  // Get all done reviews for this room, ordered by updatedAt (oldest first)
  const q = query(
    reviewsRef,
    where("roomId", "==", roomId),
    where("status", "==", "done"),
    orderBy("updatedAt", "asc")
  );

  const querySnapshot = await getDocs(q);
  const doneReviews = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Review & { id: string }));

  // If more than 10 done items, permanently delete the oldest ones
  if (doneReviews.length > 10) {
    const toDelete = doneReviews.slice(0, doneReviews.length - 10);

    // Permanently delete the oldest done reviews
    const deletePromises = toDelete.map(review => {
      const reviewRef = doc(firestore, "reviews", review.id);
      return deleteDoc(reviewRef);
    });

    await Promise.all(deletePromises);
  }
}

export async function markReviewAsUpdated(reviewId: string) {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);

  if (!reviewSnap.exists()) return;

  const review = reviewSnap.data() as Review;

  // Reset all reviewers back to pending status so they can review again
  const resetAssignees = review.assignees.map(a => ({
    ...a,
    status: "pending" as const
  }));

  await updateDoc(reviewRef, {
    assignees: resetAssignees,
    updatedAt: serverTimestamp(),
  });
}

export async function markAsReviewed(reviewId: string, userEmail: string) {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);

  if (!reviewSnap.exists()) return;

  const review = reviewSnap.data() as Review;
  const updatedAssignees = review.assignees.map(a =>
    a.email === userEmail ? { ...a, status: "reviewed" } : a
  );

  // Add user to reviewedBy list if not already present
  const reviewedBy = review.reviewedBy || [];
  const updatedReviewedBy = reviewedBy.includes(userEmail)
    ? reviewedBy
    : [...reviewedBy, userEmail];

  await updateDoc(reviewRef, {
    assignees: updatedAssignees,
    reviewedBy: updatedReviewedBy,
    updatedAt: serverTimestamp(),
  });
}

export async function markAsApproved(reviewId: string, userEmail: string) {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);

  if (!reviewSnap.exists()) return;

  const review = reviewSnap.data() as Review;

  // Add user to approvedBy list if not already present
  const approvedBy = review.approvedBy || [];
  const updatedApprovedBy = approvedBy.includes(userEmail)
    ? approvedBy
    : [...approvedBy, userEmail];

  await updateDoc(reviewRef, {
    approvedBy: updatedApprovedBy,
    updatedAt: serverTimestamp(),
  });
}

export async function updateReviewAssignees(reviewId: string, assignees: { email: string; status: "pending" | "reviewed" }[]) {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);

  if (!reviewSnap.exists()) {
    throw new Error("Review not found");
  }

  await updateDoc(reviewRef, {
    assignees: assignees,
    updatedAt: serverTimestamp(),
  });
}

export async function removeReviewer(reviewId: string, userEmail: string) {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);

  if (!reviewSnap.exists()) {
    throw new Error("Review not found");
  }

  const review = reviewSnap.data() as Review;
  const updatedAssignees = review.assignees.filter(a => a.email !== userEmail);

  await updateDoc(reviewRef, {
    assignees: updatedAssignees,
    updatedAt: serverTimestamp(),
  });

  return updatedAssignees.length === 0; // Return true if no reviewers left
}
