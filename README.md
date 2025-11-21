# Review Manager

A web application for managing code reviews using Next.js, Tailwind CSS, Firebase, and Google Chat integration.

## Features

- 🔐 Google OAuth authentication
- 📝 Review rooms with custom slugs
- 👥 User management with Google Chat integration
- 🔔 Google Chat notifications
- 📊 Review tracking (pending, reviewed, done)
- 📱 Responsive design with liquid glass UI

## Getting Started

### Prerequisites

- Node.js 20 or higher
- Firebase project with Firestore and Authentication enabled
- Google Cloud project with Google Chat API enabled (optional, for Workspace users)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd review-manager
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env.local
```

4. Fill in your Firebase configuration in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Enable Google Authentication
4. Set up Firestore security rules (see `firestore.rules`)
5. Create composite indexes (see `firestore.indexes.json`)

## Google Chat API Setup (Optional)

For Google Workspace users who want to fetch space members automatically:

1. Enable Google Chat API in [Google Cloud Console](https://console.cloud.google.com/marketplace/product/google/chat.googleapis.com)
2. Configure your Chat app in [Google Chat API Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat)
3. Add `chat.memberships.readonly` scope to OAuth consent screen

Note: Regular Gmail users can still use the app by manually entering emails.

## Deployment to Netlify

### Automatic Deployment

1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to Netlify
3. Netlify will automatically detect Next.js and use the `netlify.toml` configuration

### Manual Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to Netlify using Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Environment Variables on Netlify

Add the following environment variables in Netlify dashboard (Site settings > Environment variables):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Build Settings

Netlify will automatically use:
- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Node version**: 20 (configured in `netlify.toml`)

The `@netlify/plugin-nextjs` plugin is automatically installed and configured to handle Next.js App Router and API routes.

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── api/          # API routes
│   ├── [slug]/       # Dynamic room pages
│   └── page.tsx      # Home page
├── components/       # React components
├── context/          # React context providers
└── lib/              # Utility functions
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Chat API Documentation](https://developers.google.com/chat)
- [Netlify Next.js Plugin](https://github.com/netlify/netlify-plugin-nextjs)
