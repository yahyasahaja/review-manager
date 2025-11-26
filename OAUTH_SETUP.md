# OAuth Setup Guide for Netlify Deployment

## Problem: Popup Closes Immediately

If the Google OAuth popup closes immediately after opening, it's because the redirect URI for your Netlify domain is not configured in Google Cloud Console.

## Solution: Add Netlify Redirect URI

### Step 1: Go to Google Cloud Console

1. Navigate to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: `review-manager`
3. Go to **APIs & Services** > **Credentials**
4. Click on your OAuth 2.0 Client ID (the one used by Firebase)

### Step 2: Add Authorized Redirect URI

In the **Authorized redirect URIs** section, click **"+ Add URI"** and add:

```
https://review-queue.netlify.app/__/auth/handler
```

### Step 3: Verify Authorized JavaScript Origins

Make sure `https://review-queue.netlify.app` is in the **Authorized JavaScript origins** list. If not, add it.

### Step 4: Save

Click **Save** at the bottom of the page.

### Step 5: Update Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `review-manager-b926c`
3. Go to **Authentication**
4. Go to **Sign-in method**
5. Click on **Google**
6. Toggle the **Enable** switch to ON
7. Go to **Settings** > **Authorized domains**
8. Make sure `review-queue.netlify.app` is listed
9. If not, click **Add domain** and add it

## Complete OAuth Client Configuration

Your OAuth client should have:

### Authorized JavaScript origins:
- `http://localhost:3000` (for local development)
- `https://review-manager-b926c.firebaseapp.com` (Firebase hosting)
- `https://review-queue.netlify.app` (Netlify deployment)

### Authorized redirect URIs:
- `https://review-manager-b926c.firebaseapp.com/__/auth/handler` (Firebase hosting)
- `https://review-queue.netlify.app/__/auth/handler` (Netlify deployment) ⬅️ **This is the missing one!**

## Testing

After adding the redirect URI:

1. Wait a few minutes for changes to propagate
2. Clear your browser cache and cookies for the site
3. Try signing in again
4. The popup should now stay open and allow you to complete authentication

## Troubleshooting

### Still not working?

1. **Check browser console** for specific error messages
2. **Verify the redirect URI is exactly**: `https://review-queue.netlify.app/__/auth/handler` (no trailing slash)
3. **Check Firebase Console** > Authentication > Settings > Authorized domains
4. **Wait 5-10 minutes** after making changes (Google's changes can take time to propagate)
5. **Try incognito/private mode** to rule out browser cache issues

### Common Error Codes

- `auth/unauthorized-domain`: Domain not in authorized domains or redirect URIs
- `auth/popup-closed-by-user`: User closed the popup (normal)
- `auth/popup-blocked`: Browser blocked the popup (allow popups)

## Error: Access Blocked - Google Verification Process

If you see "Access blocked: review-manager-wage.firebaseapp.com has not completed the Google verification process", follow these steps:

### Publish Your App (For Production Use)

If you want anyone to be able to sign in (not just test users):

1. Go to **OAuth consent screen** in Google Cloud Console
2. Review all the information
3. Click **Publish App** button
4. If your app only uses non-sensitive scopes (like basic profile), it will be published immediately
5. If using sensitive scopes (like `chat.memberships.readonly`), you'll need to submit for verification

## Notes

- The redirect URI pattern for Firebase Auth is always: `{domain}/__/auth/handler`
- Each domain (localhost, Firebase hosting, Netlify) needs its own redirect URI
- Changes in Google Cloud Console can take a few minutes to propagate
- In "Testing" mode, only added test users can sign in (max 100 users)
- "Published" apps allow anyone to sign in

