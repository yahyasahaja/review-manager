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
