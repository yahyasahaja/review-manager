# Review Manager - Project Context

## Project Overview

Review Manager is a web application for managing code reviews with Google Chat integration. It allows teams to create review rooms, track review items, assign reviewers, and send notifications via Google Chat.

## Tech Stack

- **Framework**: Next.js 16.0.3 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Google OAuth)
- **External APIs**: Google Chat API (for Workspace users)
- **Deployment**: Netlify
- **UI Components**: Custom glass-morphism design system

## Key Features

### 1. Authentication
- Google OAuth via Firebase Auth
- OAuth token stored in sessionStorage for Google Chat API access
- Required scope: `chat.memberships.readonly` (for fetching space members)

### 2. Review Rooms
- Custom slug-based rooms
- Room metadata: name, slug, webhook URL, allowed users
- Room creator and all members can edit room settings
- Bulk upsert for user emails and Google Chat User IDs

### 3. Review Items
- Title, link, assignees, mentions
- Status tracking: active, done, deleted
- Assignee status: pending, reviewed
- Three display sections:
  - Created > 24h ago
  - Updated > 24h since last update
  - All active reviews
- Collapsible sections

### 4. Review Actions

**Everyone in room:**
- Delete review

**Review owner:**
- Mark as done
- Mark as updated (only if at least 1 person reviewed)
- Ping (notify all assignees)
- Delete

**Reviewer (assignee with pending status):**
- Mark as reviewed
- Delete

### 5. Google Chat Integration
- Webhook URL for sending notifications
- Automatic member fetching (Workspace only)
- User ID mapping for proper mentions
- Fallback to email mentions if user IDs unavailable

## Project Structure

```
review-manager/
├── src/
│   ├── app/
│   │   ├── [slug]/              # Dynamic room pages
│   │   │   └── page.tsx         # Room detail page with review lists
│   │   ├── api/
│   │   │   ├── notify/          # Google Chat notification endpoint
│   │   │   └── google-chat/
│   │   │       └── members/     # Fetch space members endpoint
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page (login, create/enter room)
│   │   └── globals.css          # Global styles
│   ├── components/
│   │   ├── AddReviewForm.tsx    # Form to add new reviews
│   │   ├── ReviewItem.tsx       # Individual review card with actions
│   │   ├── RoomSettings.tsx     # Room metadata editor
│   │   └── ui/
│   │       ├── GlassButton.tsx  # Glass-morphism button component
│   │       ├── GlassCard.tsx    # Glass-morphism card component
│   │       └── GlassInput.tsx   # Glass-morphism input component
│   ├── context/
│   │   └── AuthContext.tsx      # Authentication context provider
│   └── lib/
│       ├── db.ts                # Firestore database operations
│       ├── firebase.ts          # Firebase initialization
│       ├── googleChat.ts        # Google Chat API utilities
│       └── utils.ts             # General utilities
├── contexts/                    # Project documentation
│   └── PROJECT_CONTEXT.md      # This file
├── firebase.json               # Firebase configuration
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json       # Firestore composite indexes
├── netlify.toml                # Netlify deployment configuration
├── next.config.ts              # Next.js configuration
└── package.json                # Dependencies and scripts
```

## Important Implementation Details

### Authentication Flow

1. User signs in with Google via Firebase Auth
2. OAuth access token is extracted and stored in sessionStorage
3. Token is used for Google Chat API calls (fetching members)
4. Token is cleared on logout

### Room Access Control

- Users must be in `allowedUsers` list or be the room creator
- Room creator cannot be removed
- All room members can edit room settings
- All room members can delete any review

### Review Status Logic

- **Active**: Default status for new reviews
- **Done**: Set by review owner
- **Deleted**: Soft delete (status change, not actual deletion)
- Reviews are filtered by `status === "active"` in queries

### Google Chat User ID Mapping

1. User IDs can be manually entered in room settings
2. IDs can be fetched automatically (Workspace only, requires OAuth)
3. IDs are cached for 5 minutes
4. Fallback to email mentions if ID lookup fails

### Firestore Data Models

**Room:**
```typescript
{
  slug: string;
  name: string;
  webhookUrl: string;
  allowedUsers: { email: string; googleChatUserId?: string }[];
  createdBy: string;
  createdAt: Timestamp;
}
```

**Review:**
```typescript
{
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
```

### Firestore Security Rules

- Authenticated users can create/read rooms
- Room owners can update/delete their rooms
- Authenticated users can create reviews
- Review owners can update/delete their reviews
- Assignees can update their own status

### Firestore Indexes

Required composite index:
- Collection: `reviews`
- Fields: `roomId` (asc), `status` (asc), `createdAt` (desc)

## Configuration

### Environment Variables

Required in `.env.local` (development) or Netlify dashboard (production):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Firebase Setup

1. Enable Firestore Database
2. Enable Google Authentication
3. Deploy security rules: `firebase deploy --only firestore:rules`
4. Deploy indexes: `firebase deploy --only firestore:indexes`
5. Add authorized domains (including Netlify domain)

### Google Chat API Setup (Optional, Workspace only)

1. Enable Google Chat API in Google Cloud Console
2. Configure Chat app
3. Add `chat.memberships.readonly` scope to OAuth consent screen
4. Users must re-authenticate after scope is added

## Deployment

### Netlify Configuration

- Build command: `npm run build`
- Publish directory: `.next` (handled by plugin)
- Node version: 20
- Plugin: `@netlify/plugin-nextjs` (auto-installed)

### Post-Deployment

1. Set environment variables in Netlify dashboard
2. Add Netlify domain to Firebase authorized domains
3. Verify API routes work (check function logs)

## UI/UX Patterns

### Glass Morphism Design

- Liquid glass aesthetic with backdrop blur
- Layered shadows and borders
- Smooth transitions and animations
- Responsive design (mobile-first)

### Interaction Patterns

- Click card to expand/collapse actions
- Smooth transitions for all state changes
- Portal-based dropdowns for z-index issues
- Mobile-optimized touch targets

## Key Functions

### Database Operations (`src/lib/db.ts`)

- `createRoom()` - Create new review room
- `getRoom()` - Fetch room by slug
- `updateRoom()` - Update room metadata
- `addReview()` - Create new review item
- `getReviews()` - Fetch active reviews for room
- `updateReviewStatus()` - Mark review as done/deleted
- `markReviewAsUpdated()` - Update review timestamp
- `markAsReviewed()` - Mark assignee as reviewed

### Google Chat Operations (`src/lib/googleChat.ts`)

- `sendGoogleChatNotification()` - Send message via webhook
- `fetchSpaceMembersList()` - Fetch space members (OAuth required)
- `formatMentions()` - Convert emails to user mentions with IDs
- `extractSpaceName()` - Extract space name from webhook URL

### Authentication (`src/context/AuthContext.tsx`)

- `signInWithGoogle()` - Sign in with Google OAuth
- `logout()` - Sign out and clear tokens
- `getAccessToken()` - Get stored OAuth access token
- `getIdToken()` - Get Firebase ID token

## Known Limitations

1. **Google Chat API**: Only works with Google Workspace accounts
2. **User ID Mapping**: Requires manual entry or Workspace OAuth
3. **Soft Delete**: Reviews are marked as deleted, not actually removed
4. **Token Storage**: OAuth token in sessionStorage (cleared on tab close)

## Development Guidelines

### Code Style

- TypeScript strict mode
- React functional components with hooks
- Custom hooks for reusable logic
- Glass-morphism UI components
- Error handling with try-catch and user feedback

### Adding New Features

1. Follow existing patterns (context providers, custom hooks)
2. Use glass-morphism components for UI
3. Add proper error handling
4. Update Firestore rules if needed
5. Test on mobile and desktop

### Common Patterns

- State management: `useState`, `useEffect`
- Real-time updates: Firestore `onSnapshot`
- Form handling: Controlled components
- Navigation: Next.js `useRouter`
- Authentication: `useAuth` hook from context

## Future Enhancements (Potential)

- [ ] Review comments/threads
- [ ] Review history/audit log
- [ ] Email notifications
- [ ] Review templates
- [ ] Bulk review operations
- [ ] Review analytics/dashboard
- [ ] Export reviews to CSV/PDF
- [ ] Review reminders/scheduling

## Troubleshooting

### Common Issues

1. **OAuth token missing**: User needs to re-authenticate
2. **Chat API 404**: Google Chat API not enabled or not Workspace
3. **Permission denied**: Check Firestore rules and user access
4. **Index missing**: Deploy Firestore indexes
5. **Build fails**: Check Node version (should be 20)

### Debug Tips

- Check browser console for errors
- Check Netlify function logs for API errors
- Verify environment variables are set
- Check Firebase console for Firestore errors
- Verify OAuth consent screen configuration

## Related Files

- `README.md` - User-facing documentation
- `NETLIFY_DEPLOY.md` - Deployment guide
- `env.example` - Environment variable template
- `firestore.rules` - Security rules
- `firestore.indexes.json` - Database indexes

