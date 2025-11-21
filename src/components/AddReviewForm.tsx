import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { GlassCard } from "./ui/GlassCard";
import { GlassInput } from "./ui/GlassInput";
import { GlassButton } from "./ui/GlassButton";
import { addReview, Room } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { sendGoogleChatNotification, formatMentions } from "@/lib/googleChat";
import { getRoomUrl } from "@/lib/utils";

interface AddReviewFormProps {
  room: Room;
  onSuccess?: () => void;
}

export function AddReviewForm({ room, onSuccess }: AddReviewFormProps) {
  const { user, getAccessToken } = useAuth();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionInput, setMentionInput] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Auto-add mentions if they are in the allowed users list
    const assignees = mentions.map(email => ({ email, status: "pending" as const }));

    await addReview(room.slug, {
      title,
      link,
      createdBy: user.email || "",
      assignees,
      mentions,
    });

    if (room.webhookUrl) {
      const accessToken = await getAccessToken();
      const mentionText = await formatMentions(mentions, room.allowedUsers, room.webhookUrl, accessToken);
      const roomUrl = getRoomUrl(room.slug);
      await sendGoogleChatNotification(
        room.webhookUrl,
        `🆕 New Review: ${title}\n${link}\n${mentionText ? `CC: ${mentionText}` : ''}\n\n📋 View in Review Queue: ${roomUrl}`
      );
    }

    setTitle("");
    setLink("");
    setMentions([]);
    onSuccess?.();
  };

  const handleMentionAdd = (email: string) => {
    if (mentions.includes(email)) return;
    setMentions([...mentions, email]);
    setMentionInput("");
  };

  const filteredUsers = room.allowedUsers
    .filter(u => u.email.toLowerCase().includes(mentionInput.toLowerCase()))
    .filter(u => !mentions.includes(u.email));

  // Update dropdown position when input changes or window resizes
  const updateDropdownPosition = useCallback(() => {
    if (mentionInput && filteredUsers.length > 0 && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [mentionInput, filteredUsers.length]);

  useEffect(() => {
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        // Check if click is on dropdown
        const target = e.target as HTMLElement;
        if (!target.closest('.mention-dropdown')) {
          setMentionInput("");
        }
      }
    };

    if (dropdownPosition) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownPosition]);

  const dropdownContent = dropdownPosition && filteredUsers.length > 0 ? (
    <div
      className="mention-dropdown fixed bg-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl z-[99999] overflow-hidden"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
      }}
    >
      <div className="max-h-60 overflow-y-auto overscroll-contain scrollbar-thin">
        {filteredUsers.map(u => (
          <button
            key={u.email}
            type="button"
            className="block w-full text-left px-4 py-2.5 hover:bg-white/10 active:bg-white/15 rounded-lg text-sm transition-colors focus:bg-white/10 focus:outline-none text-white/90"
            onClick={() => handleMentionAdd(u.email)}
          >
            {u.email}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <GlassCard className="mb-8 overflow-visible">
      <h2 className="text-xl font-bold mb-4">Add New Review</h2>
      <form onSubmit={handleSubmit} className="space-y-4 relative">
        <div>
          <GlassInput
            placeholder="Review Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <GlassInput
            placeholder="PR / Doc Link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
          />
        </div>

        <div className="relative">
          <GlassInput
            ref={inputRef}
            placeholder="Mention users (@...)"
            value={mentionInput}
            onChange={(e) => setMentionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && mentionInput) {
                e.preventDefault();
                // Simple email validation or just add
                if (mentionInput.includes('@')) handleMentionAdd(mentionInput);
              }
            }}
          />
        </div>
        {typeof window !== 'undefined' && createPortal(dropdownContent, document.body)}

        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mentions.map(email => (
              <span key={email} className="bg-blue-500/20 text-blue-200 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                {email}
                <button
                  type="button"
                  onClick={() => setMentions(mentions.filter(m => m !== email))}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <GlassButton type="submit" className="w-full">
          Add Review
        </GlassButton>
      </form>
    </GlassCard>
  );
}
