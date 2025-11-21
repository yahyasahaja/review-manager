"use client";

import { useAuth } from "@/context/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/db";
import { fetchSpaceMembersList, SpaceMember } from "@/lib/googleChat";

export default function Home() {
  const { user, signInWithGoogle, logout, loading, getAccessToken } = useAuth();
  const [roomSlug, setRoomSlug] = useState("");
  const router = useRouter();

  // Check for return URL from room page
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Create Room State
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomSlug, setNewRoomSlug] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [allowedUsers, setAllowedUsers] = useState("");
  const [spaceMembers, setSpaceMembers] = useState<SpaceMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Get return URL from query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const returnToParam = params.get('returnTo');
      if (returnToParam) {
        setReturnTo(returnToParam);
      }
    }
  }, []);

  // Redirect to room after login if returnTo is set
  useEffect(() => {
    if (!loading && user && returnTo) {
      // Small delay to ensure auth state is fully updated
      setTimeout(() => {
        router.push(`/${returnTo}`);
      }, 100);
    }
  }, [user, loading, returnTo, router]);

  const handleEnterRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomSlug) {
      router.push(`/${roomSlug}`);
    }
  };

  const handleFetchMembers = async () => {
    if (!webhookUrl) {
      alert("Please enter a webhook URL first");
      return;
    }

    setIsFetchingMembers(true);
    try {
      const accessToken = await getAccessToken();
      const members = await fetchSpaceMembersList(webhookUrl, accessToken || undefined);

      if (members.length === 0) {
        alert("No members found or unable to fetch. You can manually enter emails instead.");
        setShowManualInput(true);
      } else {
        setSpaceMembers(members);
        // Auto-select all members by default
        setSelectedMembers(new Set(members.map(m => m.email)));
      }
    } catch (error: any) {
      console.error("Error fetching members:", error);

      // Check if it's a scope error
      if (error?.isScopeError || error?.message?.includes("insufficient authentication scopes") ||
          error?.message?.includes("insufficient authentication")) {
        const shouldReauth = confirm(
          "Your Google account needs Chat API permissions. " +
          "Please sign out and sign in again to grant these permissions. " +
          "Also make sure the OAuth consent screen in Google Cloud Console includes the 'chat.memberships.readonly' scope.\n\n" +
          "Sign in again now?"
        );
        if (shouldReauth) {
          await logout();
          await signInWithGoogle();
          // After re-auth, user can try fetching again
          alert("Please try fetching members again after signing in.");
        }
      } else if (error?.isNotFoundError || error?.message?.includes("Chat app not found") ||
                 error?.message?.includes("Chat API not enabled")) {
        alert(
          "Google Chat API requires Google Workspace.\n\n" +
          "IMPORTANT: The Google Chat API is only available for Google Workspace accounts, not regular Gmail accounts.\n\n" +
          "If you have Google Workspace, the application owner needs to:\n" +
          "1. Enable the Google Chat API: https://console.cloud.google.com/marketplace/product/google/chat.googleapis.com\n" +
          "2. Configure your Chat app: https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat\n" +
          "3. Add 'chat.memberships.readonly' scope to OAuth consent screen\n\n" +
          "If you don't have Google Workspace, you can still use the app by manually entering emails."
        );
      } else {
        alert("Failed to fetch members: " + (error?.message || "Unknown error") + ". You can manually enter emails instead.");
      }
      setShowManualInput(true);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  const handleToggleMember = (email: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedMembers(newSelected);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let usersList: { email: string; googleChatUserId?: string }[] = [];

      // Use selected members if available, otherwise use manual input
      if (selectedMembers.size > 0) {
        usersList = Array.from(selectedMembers).map(email => {
          const member = spaceMembers.find(m => m.email === email);
          return {
            email: email,
            googleChatUserId: member?.userId,
          };
        });
      } else if (allowedUsers.trim()) {
        usersList = allowedUsers.split(",").map(email => ({ email: email.trim() }));
      }

      // Always include the creator
      if (user?.email && !usersList.some(u => u.email === user.email)) {
        usersList.push({ email: user.email });
      }

      await createRoom({
        slug: newRoomSlug,
        name: newRoomName,
        webhookUrl: webhookUrl,
        allowedUsers: usersList,
        createdBy: user?.email || "",
      });
      router.push(`/${newRoomSlug}`);
    } catch (error) {
      alert("Error creating room: " + error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="z-10 w-full max-w-md items-center justify-between font-mono text-sm">
        <GlassCard className="w-full text-center">
          <h1 className="mb-8 text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200">
            Review Manager
          </h1>

          {!user ? (
            <div className="space-y-4">
              <p className="text-lg mb-6">Manage your code reviews with style.</p>
              {returnTo && (
                <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-200 text-center">
                    Please sign in to access the room
                  </p>
                </div>
              )}
              <GlassButton onClick={signInWithGoogle} className="w-full">
                Sign in with Google
              </GlassButton>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm opacity-80">Welcome, {user.displayName}</p>
                <GlassButton variant="ghost" onClick={logout} className="text-xs px-2 py-1">
                  Logout
                </GlassButton>
              </div>

              {!isCreating ? (
                <>
                  <form onSubmit={handleEnterRoom} className="space-y-4">
                    <GlassInput
                      placeholder="Enter Room Slug"
                      value={roomSlug}
                      onChange={(e) => setRoomSlug(e.target.value)}
                    />
                    <GlassButton type="submit" className="w-full">
                      Enter Room
                    </GlassButton>
                  </form>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink mx-4 text-white/30 text-xs">OR</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <GlassButton
                    variant="ghost"
                    onClick={() => setIsCreating(true)}
                    className="w-full"
                  >
                    Create New Room
                  </GlassButton>
                </>
              ) : (
                <form onSubmit={handleCreateRoom} className="space-y-4 text-left">
                  <h2 className="text-xl font-bold mb-4">Create Room</h2>
                  <div>
                    <label className="text-xs opacity-70 ml-1">Room Slug (ID)</label>
                    <GlassInput
                      required
                      placeholder="e.g. android-team"
                      value={newRoomSlug}
                      onChange={(e) => setNewRoomSlug(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs opacity-70 ml-1">Room Name</label>
                    <GlassInput
                      required
                      placeholder="e.g. Android Team Reviews"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs opacity-70 ml-1">
                      Google Chat Webhook URL
                      <span className="text-xs text-yellow-400/70 ml-1">(Workspace only)</span>
                    </label>
                    <div className="flex gap-2">
                      <GlassInput
                        placeholder="https://chat.googleapis.com/v1/spaces/..."
                        value={webhookUrl}
                        onChange={(e) => {
                          setWebhookUrl(e.target.value);
                          // Reset members when URL changes
                          setSpaceMembers([]);
                          setSelectedMembers(new Set());
                        }}
                        className="flex-1"
                      />
                      <GlassButton
                        type="button"
                        onClick={handleFetchMembers}
                        disabled={!webhookUrl || isFetchingMembers}
                        className="shrink-0"
                        title="Requires Google Workspace account"
                      >
                        {isFetchingMembers ? "Loading..." : "Fetch Members"}
                      </GlassButton>
                    </div>
                    <p className="text-xs text-yellow-400/70 mt-1 ml-1">
                      Note: Fetching members requires Google Workspace. Regular Gmail accounts can still use manual email input.
                    </p>
                  </div>

                  {spaceMembers.length > 0 && (
                    <div>
                      <label className="text-xs opacity-70 ml-1 mb-2 block">
                        Select Space Members ({selectedMembers.size} selected)
                      </label>
                      <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                        {spaceMembers.map((member) => (
                          <label
                            key={member.email}
                            className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedMembers.has(member.email)}
                              onChange={() => handleToggleMember(member.email)}
                              className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white">{member.displayName}</div>
                              <div className="text-xs text-white/60 truncate">{member.email}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedMembers.size === spaceMembers.length) {
                            setSelectedMembers(new Set());
                          } else {
                            setSelectedMembers(new Set(spaceMembers.map(m => m.email)));
                          }
                        }}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                      >
                        {selectedMembers.size === spaceMembers.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs opacity-70 ml-1">
                        {spaceMembers.length > 0 ? "Or manually add emails" : "Allowed Emails (comma separated)"}
                      </label>
                      {spaceMembers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowManualInput(!showManualInput)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {showManualInput ? "Hide" : "Show"} Manual Input
                        </button>
                      )}
                    </div>
                    {(showManualInput || spaceMembers.length === 0) && (
                      <GlassInput
                        placeholder="john@example.com, jane@example.com"
                        value={allowedUsers}
                        onChange={(e) => setAllowedUsers(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <GlassButton
                      type="button"
                      variant="ghost"
                      onClick={() => setIsCreating(false)}
                      className="flex-1"
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton type="submit" className="flex-1">
                      Create
                    </GlassButton>
                  </div>
                </form>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
