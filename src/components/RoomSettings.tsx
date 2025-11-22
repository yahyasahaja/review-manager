"use client";

import { useState } from "react";
import { Room, updateRoom } from "@/lib/db";
import { GlassCard } from "./ui/GlassCard";
import { GlassButton } from "./ui/GlassButton";
import { GlassInput } from "./ui/GlassInput";
import { useAuth } from "@/context/AuthContext";
import { XMarkIcon, PlusIcon, TrashIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";

interface RoomSettingsProps {
  room: Room;
  onUpdate?: () => void;
}

export function RoomSettings({ room, onUpdate }: RoomSettingsProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(room.name);
  const [webhookUrl, setWebhookUrl] = useState(room.webhookUrl);
  const [allowedUsers, setAllowedUsers] = useState(room.allowedUsers);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserGoogleChatId, setNewUserGoogleChatId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserIdValue, setEditingUserIdValue] = useState("");
  const [showBulkUpsert, setShowBulkUpsert] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Check if user has permission to edit (everyone in the room can edit)
  const canEdit = room.allowedUsers.some(u => u.email === user?.email) || room.createdBy === user?.email;

  if (!canEdit) {
    return null;
  }

  const handleAddUser = () => {
    if (!newUserEmail.trim()) return;

    const email = newUserEmail.trim().toLowerCase();
    const existingUserIndex = allowedUsers.findIndex(u => u.email.toLowerCase() === email);

    if (existingUserIndex !== -1) {
      // User exists, update their Google Chat User ID
      const updatedUsers = [...allowedUsers];
      updatedUsers[existingUserIndex] = {
        ...updatedUsers[existingUserIndex],
        googleChatUserId: newUserGoogleChatId.trim() || undefined,
      };
      setAllowedUsers(updatedUsers);
      setNewUserEmail("");
      setNewUserGoogleChatId("");
      return;
    }

    // New user, add them
    setAllowedUsers([
      ...allowedUsers,
      {
        email: email,
        googleChatUserId: newUserGoogleChatId.trim() || undefined,
      },
    ]);
    setNewUserEmail("");
    setNewUserGoogleChatId("");
  };

  const handleStartEditUserId = (email: string, currentUserId?: string) => {
    setEditingUserId(email);
    setEditingUserIdValue(currentUserId || "");
  };

  const handleSaveUserId = (email: string) => {
    const updatedUsers = allowedUsers.map(u =>
      u.email === email
        ? { ...u, googleChatUserId: editingUserIdValue.trim() || undefined }
        : u
    );
    setAllowedUsers(updatedUsers);
    setEditingUserId(null);
    setEditingUserIdValue("");
  };

  const handleCancelEditUserId = () => {
    setEditingUserId(null);
    setEditingUserIdValue("");
  };

  const handleRemoveUser = (email: string) => {
    if (email === room.createdBy) {
      alert("Cannot remove the room creator");
      return;
    }
    setAllowedUsers(allowedUsers.filter(u => u.email !== email));
  };

  const handleBulkUpsert = () => {
    if (!bulkInput.trim()) {
      alert("Please enter email and user ID pairs");
      return;
    }

    const lines = bulkInput.trim().split('\n').filter(line => line.trim());
    const updatedUsers = new Map<string, { email: string; googleChatUserId?: string }>();

    // Keep existing users first
    allowedUsers.forEach(user => {
      updatedUsers.set(user.email.toLowerCase(), { ...user });
    });

    // Parse and upsert from bulk input
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Split by whitespace - first part is email, rest is user ID
      const parts = trimmed.split(/\s+/);
      if (parts.length < 1) {
        errors.push(`Line ${index + 1}: Invalid format`);
        errorCount++;
        return;
      }

      // Preserve original email casing for display, but use lowercase for key
      const originalEmail = parts[0].trim();
      const emailLower = originalEmail.toLowerCase();
      const userId = parts.length > 1 ? parts.slice(1).join(' ').trim() : undefined;

      // Basic email validation
      if (!emailLower.includes('@')) {
        errors.push(`Line ${index + 1}: Invalid email format: ${originalEmail}`);
        errorCount++;
        return;
      }

      // Upsert: update if exists, add if new
      // Use lowercase email as key for deduplication, but preserve original casing
      const existingUser = updatedUsers.get(emailLower);
      updatedUsers.set(emailLower, {
        email: originalEmail, // Preserve original casing
        googleChatUserId: userId || existingUser?.googleChatUserId,
      });
      successCount++;
    });

    // Ensure room creator is always included (preserve their existing data if already in map)
    if (room.createdBy) {
      const creatorEmail = room.createdBy.toLowerCase();
      if (!updatedUsers.has(creatorEmail)) {
        // Try to find in original allowedUsers to preserve their user ID
        const existingCreator = allowedUsers.find(u => u.email.toLowerCase() === creatorEmail);
        updatedUsers.set(creatorEmail, {
          email: room.createdBy,
          googleChatUserId: existingCreator?.googleChatUserId,
        });
      }
    }

    // Ensure current user (application owner) is included (preserve their existing data if already in map)
    if (user?.email) {
      const userEmail = user.email.toLowerCase();
      if (!updatedUsers.has(userEmail)) {
        // Try to find in original allowedUsers to preserve their user ID
        const existingUser = allowedUsers.find(u => u.email.toLowerCase() === userEmail);
        updatedUsers.set(userEmail, {
          email: user.email,
          googleChatUserId: existingUser?.googleChatUserId,
        });
      }
    }

    const finalUsers = Array.from(updatedUsers.values());

    setAllowedUsers(finalUsers);
    setBulkInput("");

    if (errorCount > 0) {
      alert(`Bulk upsert completed with ${successCount} success(es) and ${errorCount} error(s).\n\nErrors:\n${errors.join('\n')}`);
    } else {
      alert(`Successfully upserted ${successCount} user(s).`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateRoom(room.slug, {
        name,
        webhookUrl,
        allowedUsers,
      });
      setIsOpen(false);
      onUpdate?.();
    } catch (error) {
      alert("Error updating room: " + error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(room.name);
    setWebhookUrl(room.webhookUrl);
    setAllowedUsers(room.allowedUsers);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <GlassButton
        variant="ghost"
        onClick={() => setIsOpen(true)}
        className="mb-4"
      >
        ⚙️ Room Settings
      </GlassButton>
    );
  }

  return (
    <GlassCard className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Room Settings</h2>
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs opacity-70 ml-1 mb-1 block">Room Name</label>
          <GlassInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room Name"
          />
        </div>

        <div>
          <label className="text-xs opacity-70 ml-1 mb-1 block">Google Chat Webhook URL</label>
          <GlassInput
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://chat.googleapis.com/v1/spaces/..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs opacity-70 ml-1 block">Allowed Users</label>
            <button
              onClick={() => setShowBulkUpsert(!showBulkUpsert)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 underline"
            >
              <DocumentDuplicateIcon className="w-3.5 h-3.5" />
              {showBulkUpsert ? "Hide" : "Bulk Upsert"}
            </button>
          </div>

          {/* Bulk Upsert Section */}
          {showBulkUpsert && (
            <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
              <label className="text-xs opacity-70 ml-1 mb-2 block">
                Bulk Upsert (one per line: email userid)
              </label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="yahya.sahaja@bukalapak.com 105973750758087866559&#10;imam.fauzan@bukalapak.com 114211335648455891533&#10;wilik@bukalapak.com 108287883596346629199"
                className="w-full min-h-[120px] px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 resize-y"
                style={{ fontFamily: 'monospace' }}
              />
              <div className="flex gap-2 mt-2">
                <GlassButton
                  onClick={handleBulkUpsert}
                  className="flex items-center gap-2"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  Upsert Users
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  onClick={() => {
                    setBulkInput("");
                    setShowBulkUpsert(false);
                  }}
                >
                  Clear
                </GlassButton>
              </div>
              <p className="text-xs text-white/50 mt-2 ml-1">
                Format: email@example.com userid (one per line). Existing users will be updated, new users will be added. Room creator and your account will always be included.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {allowedUsers.map((user, index) => {
              // Extract username and domain for display
              const emailParts = user.email.split('@');
              const username = emailParts[0];
              const domain = emailParts[1] || '';

              // Find all users with the same username
              const sameUsernameUsers = allowedUsers
                .map((u, idx) => {
                  const uParts = u.email.split('@');
                  return { email: u.email, index: idx, username: uParts[0] };
                })
                .filter(u => u.username === username)
                .sort((a, b) => a.index - b.index);

              // Show identifier if there are multiple users with same username
              const showIdentifier = sameUsernameUsers.length > 1;
              const identifierNumber = sameUsernameUsers.findIndex(u => u.email === user.email) + 1;

              return (
              <div
                key={user.email}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {showIdentifier && (
                      <span className="inline-block mr-2 px-1.5 py-0.5 text-xs font-bold bg-blue-500/30 text-blue-200 rounded border border-blue-400/50">
                        #{identifierNumber}
                      </span>
                    )}
                    <span className="font-semibold">{username}</span>
                    {domain && <span className="text-white/70">@{domain}</span>}
                  </div>
                  {editingUserId === user.email ? (
                    <div className="flex gap-2 mt-2">
                      <GlassInput
                        value={editingUserIdValue}
                        onChange={(e) => setEditingUserIdValue(e.target.value)}
                        placeholder="Google Chat User ID"
                        className="flex-1 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveUserId(user.email);
                          } else if (e.key === 'Escape') {
                            handleCancelEditUserId();
                          }
                        }}
                        autoFocus
                      />
                      <GlassButton
                        onClick={() => handleSaveUserId(user.email)}
                        className="px-2! py-1! text-xs"
                        variant="ghost"
                      >
                        Save
                      </GlassButton>
                      <GlassButton
                        onClick={handleCancelEditUserId}
                        className="px-2! py-1! text-xs"
                        variant="ghost"
                      >
                        Cancel
                      </GlassButton>
                    </div>
                  ) : (
                    <>
                      {user.googleChatUserId ? (
                        <div className="text-xs text-white/50 mt-1">
                          Google Chat ID: {user.googleChatUserId}
                        </div>
                      ) : (
                        <div className="text-xs text-white/30 mt-1 italic">
                          No Google Chat ID set
                        </div>
                      )}
                      <button
                        onClick={() => handleStartEditUserId(user.email, user.googleChatUserId)}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1 underline"
                      >
                        {user.googleChatUserId ? "Edit ID" : "Add ID"}
                      </button>
                    </>
                  )}
                  {user.email === room.createdBy && (
                    <div className="text-xs text-blue-400 mt-1">Room Creator</div>
                  )}
                </div>
                {user.email !== room.createdBy && (
                  <button
                    onClick={() => handleRemoveUser(user.email)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Remove user"
                  >
                    <TrashIcon className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
              );
            })}

            <div className="flex gap-2 mt-3">
              <GlassInput
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com (or existing user to update ID)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUser();
                  }
                }}
                className="flex-1"
              />
              <GlassInput
                value={newUserGoogleChatId}
                onChange={(e) => setNewUserGoogleChatId(e.target.value)}
                placeholder="Google Chat User ID (optional)"
                className="flex-1"
              />
              <GlassButton
                onClick={handleAddUser}
                className="flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                {newUserEmail.trim() && allowedUsers.some(u => u.email.toLowerCase() === newUserEmail.trim().toLowerCase())
                  ? "Update ID"
                  : "Add"}
              </GlassButton>
            </div>
            <p className="text-xs text-white/50 mt-2 ml-1">
              Tip: You can add new users or update Google Chat IDs for existing users (including yourself)
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <GlassButton
            variant="ghost"
            onClick={handleCancel}
            className="flex-1"
            disabled={isSaving}
          >
            Cancel
          </GlassButton>
          <GlassButton
            onClick={handleSave}
            className="flex-1"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}

