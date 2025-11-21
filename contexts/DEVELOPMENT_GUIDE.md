# Development Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## Common Development Tasks

### Adding a New Review Action

1. Add the action handler in `src/components/ReviewItem.tsx`
2. Update the action button in the JSX (owner/reviewer/everyone sections)
3. Add notification logic if needed (use `sendGoogleChatNotification`)
4. Update Firestore if needed (add new status or field)

### Adding a New API Route

1. Create route file in `src/app/api/[route-name]/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` function
3. Use `NextResponse.json()` for responses
4. Handle errors with proper status codes

### Modifying Room Settings

1. Update `Room` interface in `src/lib/db.ts` if adding fields
2. Update `RoomSettings.tsx` component UI
3. Update `updateRoom()` function if needed
4. Update Firestore security rules if access changes

### Adding a New UI Component

1. Create component in `src/components/ui/` for reusable components
2. Follow glass-morphism design pattern
3. Use `GlassCard`, `GlassButton`, `GlassInput` as base
4. Export from component file

### Modifying Firestore Rules

1. Edit `firestore.rules`
2. Deploy: `firebase deploy --only firestore:rules`
3. Test in Firebase Console > Firestore > Rules

### Adding Firestore Index

1. Edit `firestore.indexes.json`
2. Deploy: `firebase deploy --only firestore:indexes`
3. Wait for index to build (check Firebase Console)

## Code Patterns

### State Management

```typescript
// Local state
const [state, setState] = useState(initialValue);

// Real-time Firestore subscription
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // Handle updates
  });
  return () => unsubscribe();
}, [dependencies]);
```

### Form Handling

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await someAsyncOperation();
    // Reset form
    setFormData(initialState);
  } catch (error) {
    alert("Error: " + error);
  }
};
```

### Authentication

```typescript
const { user, signInWithGoogle, logout, getAccessToken } = useAuth();

// Check if user is logged in
if (!user) {
  router.push('/');
  return;
}

// Get OAuth token for Google Chat API
const accessToken = await getAccessToken();
```

### Error Handling

```typescript
try {
  await operation();
} catch (error: any) {
  console.error("Error:", error);
  alert("Error: " + (error?.message || "Unknown error"));
}
```

## Testing Checklist

Before deploying:

- [ ] Test on mobile viewport
- [ ] Test on desktop viewport
- [ ] Verify all actions work (create, update, delete)
- [ ] Test authentication flow
- [ ] Test Google Chat notifications
- [ ] Verify Firestore rules work
- [ ] Check console for errors
- [ ] Test with different user roles (owner, reviewer, member)

## Debugging Tips

### Firestore Issues

- Check Firebase Console > Firestore > Data
- Check Firestore rules in Console
- Check browser console for permission errors
- Verify indexes are built

### Authentication Issues

- Check Firebase Console > Authentication
- Verify authorized domains include your domain
- Check browser console for auth errors
- Clear sessionStorage and re-authenticate

### Google Chat API Issues

- Check if user has Workspace account
- Verify OAuth token exists in sessionStorage
- Check API route logs in Netlify
- Verify OAuth consent screen has correct scopes

### Build Issues

- Check Node version (should be 20)
- Clear `.next` folder and rebuild
- Check for TypeScript errors
- Verify all environment variables are set

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push and create PR
git push origin feature/new-feature
```

## Environment Variables

Always update `env.example` when adding new environment variables.

Never commit `.env.local` or `.env` files.

## Code Style

- Use TypeScript strict mode
- Prefer functional components
- Use meaningful variable names
- Add comments for complex logic
- Follow existing code patterns
- Keep components small and focused

## Performance Considerations

- Use `useCallback` for event handlers passed to children
- Use `useMemo` for expensive computations
- Avoid unnecessary re-renders
- Use Firestore queries efficiently (with proper indexes)
- Cache Google Chat user IDs (already implemented)

## Security Best Practices

- Never expose API keys in client code
- Use `NEXT_PUBLIC_` prefix only for safe public variables
- Validate user input
- Check permissions before operations
- Use Firestore security rules
- Sanitize user input for XSS prevention

