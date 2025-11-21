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

export interface Room {
  slug: string;
  name: string;
  webhookUrl: string;
  allowedUsers: { email: string; googleChatUserId?: string }[];
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
  mentions: string[];
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

  await updateDoc(roomRef, updates);
}

export async function addReview(roomId: string, data: Omit<Review, "id" | "roomId" | "createdAt" | "updatedAt" | "status">) {
  const firestore = checkDb();
  const reviewsRef = collection(firestore, "reviews");
  await addDoc(reviewsRef, {
    ...data,
    roomId,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  await updateDoc(reviewRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function markReviewAsUpdated(reviewId: string) {
  const firestore = checkDb();
  const reviewRef = doc(firestore, "reviews", reviewId);
  await updateDoc(reviewRef, {
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

  await updateDoc(reviewRef, {
    assignees: updatedAssignees,
    updatedAt: serverTimestamp(),
  });
}
