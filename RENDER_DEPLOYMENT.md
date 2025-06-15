# Quick Render Deployment Guide

This is the fastest way to get your Fodinha Card Game running with a real backend.

## Prerequisites

✅ Your code is already pushed to GitHub  
✅ Frontend is deployed on Render  
✅ All required files are in place (`render.yaml`, `pages/api/health.ts`)

## Step 1: Deploy Backend to Render (5 minutes)

1. **Go to [render.com](https://render.com)** and sign up
2. **Connect GitHub**: Click "New +" → "Web Service" → Connect GitHub
3. **Select Repository**: Choose `fodinha-card-arena`
4. **Configure Service**:
   ```
   Name: fodinha-card-game-backend
   Environment: Node
   Branch: main
   Build Command: npm install
   Start Command: npm run start
   ```
5. **Set Environment Variables**:
   ```
   NODE_ENV = production
   PORT = 10000
   ```
6. **Click "Create Web Service"**
7. **Wait 2-5 minutes** for deployment
8. **Copy your service URL**: `https://fodinha-card-game-backend.onrender.com`

## Step 2: Connect Frontend to Backend (2 minutes)

1. **Create `.env.production`** in your project root:
   ```env
   VITE_BACKEND_URL=https://your-actual-render-url.onrender.com
   ```

2. **Update CORS in your backend** (pages/api/socket.ts):
   ```javascript
   // Find the CORS configuration and update it
   const allowedOrigins = [
     'https://your-frontend-url.onrender.com', // Replace with your actual Render URL
     'http://localhost:3000'
   ];
   ```

3. **Push changes to GitHub**:
   ```bash
   git add .
   git commit -m "Add production backend URL"
   git push
   ```

4. **Render will auto-deploy** your updated frontend

## Step 3: Test (1 minute)

1. **Visit your Render frontend URL**
2. **Should see "Connecting..." then no demo banner**
3. **Create a game** - should work with real multiplayer!

## Troubleshooting

### "Backend Not Available" still showing?
- Check your Render service logs for errors
- Verify the `.env.production` file has the correct URL
- Make sure both services are running

### WebSocket errors?
- Update CORS settings in your backend
- Check that your Render service is awake (free tier sleeps)

### Games not working?
- Visit `https://your-render-url.onrender.com/api/health` to test backend
- Check browser console for errors

## URLs to Remember

- **Your Backend**: https://your-render-service.onrender.com
- **Your Frontend**: https://your-frontend.onrender.com
- **Health Check**: https://your-render-service.onrender.com/api/health

## Cost

- **Free Tier**: Perfect for testing and small games
- **Starter Plan** ($7/month): Better performance, no cold starts

You're done! 🎉 Your game should now have full multiplayer functionality. 