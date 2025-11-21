# Netlify Deployment Guide

This guide will help you deploy the Review Manager application to Netlify.

## Prerequisites

- A Netlify account (sign up at [netlify.com](https://www.netlify.com))
- Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- Firebase project configured
- Environment variables ready

## Deployment Steps

### Option 1: Deploy via Netlify UI (Recommended)

1. **Connect Repository**
   - Log in to [Netlify](https://app.netlify.com)
   - Click "Add new site" > "Import an existing project"
   - Connect your Git provider and select the repository

2. **Configure Build Settings**
   - Netlify will auto-detect Next.js and use the `netlify.toml` configuration
   - Build command: `npm run build` (auto-detected)
   - Publish directory: `.next` (handled by Netlify Next.js plugin)
   - Node version: `20` (configured in `netlify.toml`)

3. **Set Environment Variables**
   - Go to Site settings > Environment variables
   - Add the following variables:
     ```
     NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
     ```

4. **Deploy**
   - Click "Deploy site"
   - Netlify will build and deploy your application
   - The `@netlify/plugin-nextjs` plugin will be automatically installed

### Option 2: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize Site**
   ```bash
   netlify init
   ```
   - Follow the prompts to link your site
   - Choose "Create & configure a new site"

4. **Set Environment Variables**
   ```bash
   netlify env:set NEXT_PUBLIC_FIREBASE_API_KEY "your_api_key"
   netlify env:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN "your_auth_domain"
   netlify env:set NEXT_PUBLIC_FIREBASE_PROJECT_ID "your_project_id"
   netlify env:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET "your_storage_bucket"
   netlify env:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "your_sender_id"
   netlify env:set NEXT_PUBLIC_FIREBASE_APP_ID "your_app_id"
   ```

5. **Deploy**
   ```bash
   netlify deploy --prod
   ```

## Post-Deployment

### Firebase Configuration

1. **Update Authorized Domains**
   - Go to Firebase Console > Authentication > Settings > Authorized domains
   - Add your Netlify domain (e.g., `your-site.netlify.app`)

2. **Update Firestore Rules** (if needed)
   - Ensure your Firestore security rules allow access from your Netlify domain

### Custom Domain (Optional)

1. Go to Site settings > Domain management
2. Click "Add custom domain"
3. Follow the DNS configuration instructions
4. Update Firebase authorized domains with your custom domain

## Troubleshooting

### Build Fails

- Check Node version (should be 20)
- Verify all environment variables are set
- Check build logs in Netlify dashboard

### API Routes Not Working

- Ensure `@netlify/plugin-nextjs` is installed (auto-installed)
- Check that API routes are in `src/app/api/` directory
- Verify function logs in Netlify dashboard

### Authentication Issues

- Verify Firebase authorized domains include your Netlify domain
- Check that all `NEXT_PUBLIC_*` environment variables are set correctly
- Ensure Firebase project is properly configured

## Continuous Deployment

Once connected to Git, Netlify will automatically:
- Deploy on every push to the main branch
- Create preview deployments for pull requests
- Run builds automatically

You can configure branch settings in Site settings > Build & deploy > Continuous deployment.

## Support

For more information:
- [Netlify Documentation](https://docs.netlify.com/)
- [Next.js on Netlify](https://docs.netlify.com/integrations/frameworks/next-js/)
- [Netlify Next.js Plugin](https://github.com/netlify/netlify-plugin-nextjs)

