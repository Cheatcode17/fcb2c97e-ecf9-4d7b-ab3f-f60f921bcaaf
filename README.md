# YouTube Downloader

A modern, full-stack YouTube video and audio downloader with a beautiful React frontend and Node.js backend.

## Features

- 🎥 Download YouTube videos in multiple resolutions (144p - 1080p)
- 🎵 Extract audio as MP3 files
- 📱 Responsive, modern UI with glassmorphism design
- ⚡ Real-time progress tracking
- 🔍 Video information preview with thumbnails
- ✨ Beautiful animations and transitions

## Architecture Overview

This project uses:
- **Frontend**: React app (this Lovable project) 
- **Edge Functions**: Supabase functions for API routing and validation
- **Backend Server**: Node.js server for YouTube processing (separate setup required)

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │───▶│ Supabase Edge    │───▶│   Node.js       │
│   (Frontend)    │    │   Functions      │    │   Backend       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Frontend (React + TypeScript + Tailwind)

The frontend is built with:
- **React 18** with TypeScript
- **Tailwind CSS** with custom design system
- **Shadcn/ui** components
- **Responsive design** with glassmorphism effects
- **YouTube-themed** color scheme

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:8080`

## Complete Backend Setup Tutorial

Create a separate directory for your backend server outside this project:

```bash
# Navigate to your projects folder
cd ..

# Create backend directory
mkdir youtube-downloader-backend
cd youtube-downloader-backend

# Initialize package.json
npm init -y
```

### Step 2: Install Dependencies

```bash
# Core dependencies
npm install express cors ytdl-core

# Development dependencies  
npm install -D nodemon concurrently

# Optional: For better error handling and logging
npm install helmet morgan winston
```

### Step 3: Create Project Structure

```bash
# Create directories
mkdir routes middleware utils

# Create files
touch server.js
touch routes/video.js
touch middleware/errorHandler.js
touch utils/logger.js
```

Your structure should look like:
```
youtube-downloader-backend/
├── package.json
├── server.js
├── routes/
│   └── video.js
├── middleware/
│   └── errorHandler.js
└── utils/
    └── logger.js
```

### Step 4: Complete Backend Implementation

**server.js** (Main server file):
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const videoRoutes = require('./routes/video');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173'], // Add your frontend URLs
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', videoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
```

**routes/video.js** (Video processing routes):
```javascript
const express = require('express');
const ytdl = require('ytdl-core');
const router = express.Router();

// Get video information
router.post('/video-info', async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    const formats = info.formats;

    // Get available video qualities
    const videoFormats = formats
      .filter(format => format.hasVideo && format.hasAudio)
      .map(format => ({
        quality: format.qualityLabel,
        container: format.container,
        size: format.contentLength
      }))
      .filter((format, index, self) => 
        index === self.findIndex(f => f.quality === format.quality)
      );

    // Get audio formats
    const audioFormats = formats
      .filter(format => format.hasAudio && !format.hasVideo)
      .map(format => ({
        quality: format.audioBitrate + 'kbps',
        container: format.container,
        size: format.contentLength
      }));

    res.json({
      success: true,
      data: {
        title: videoDetails.title,
        thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url,
        duration: formatDuration(videoDetails.lengthSeconds),
        author: videoDetails.author.name,
        views: formatViews(videoDetails.viewCount),
        videoId: videoDetails.videoId,
        formats: {
          video: videoFormats,
          audio: audioFormats
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Download video/audio
router.post('/download', async (req, res, next) => {
  try {
    const { url, type, quality } = req.body;

    if (!url || !type) {
      return res.status(400).json({ error: 'URL and type are required' });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, ''); // Clean filename

    let stream;
    let filename;
    let contentType;

    if (type === 'audio') {
      stream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio'
      });
      filename = `${title}_audio.mp4`;
      contentType = 'audio/mp4';
    } else {
      const format = quality ? 
        format => format.qualityLabel === quality && format.hasVideo && format.hasAudio :
        format => format.hasVideo && format.hasAudio;
      
      stream = ytdl(url, {
        filter: format,
        quality: quality ? quality : 'highest'
      });
      filename = `${title}_${quality || 'best'}.mp4`;
      contentType = 'video/mp4';
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    // Handle stream errors
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });

    // Pipe the stream to response
    stream.pipe(res);

  } catch (error) {
    next(error);
  }
});

// Utility functions
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views) {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}

module.exports = router;
```

**middleware/errorHandler.js**:
```javascript
const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);

  // YouTube-dl errors
  if (error.message.includes('Video unavailable')) {
    return res.status(404).json({ error: 'Video not available or private' });
  }

  if (error.message.includes('Sign in to confirm your age')) {
    return res.status(403).json({ error: 'Age-restricted content not supported' });
  }

  // Generic server error
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

module.exports = errorHandler;
```

### Step 5: Update package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### Step 6: Environment Configuration

Create `.env` file:
```env
PORT=3001
NODE_ENV=development
```

Create `.gitignore`:
```
node_modules/
.env
*.log
dist/
build/
```

## 🚀 Quick Integration Guide

### Method 1: Direct Backend Connection (Simple)

Update your Supabase Edge Functions to point to your local backend:

In `supabase/functions/fetch-info/index.ts`, replace the API calls with:
```typescript
// Call your local backend
const response = await fetch('http://localhost:3001/api/video-info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url })
});
```

### Method 2: Environment-based Configuration (Recommended)

Create a configuration system that switches between local development and production:

1. **Add environment detection to your Edge Functions:**

```typescript
const BACKEND_URL = Deno.env.get('BACKEND_URL') || 'http://localhost:3001';

const response = await fetch(`${BACKEND_URL}/api/video-info`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url })
});
```

2. **Set environment variables in Supabase:**
   - Go to your Supabase dashboard
   - Navigate to Settings > Edge Functions
   - Add `BACKEND_URL` environment variable

### Method 3: Bypass Edge Functions (Development Only)

For rapid local development, update your frontend to call the backend directly:

```typescript
// In src/components/YouTubeDownloader.tsx
const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:3001/api' 
  : '/functions/v1';

const fetchVideoInfo = async () => {
  const endpoint = import.meta.env.DEV 
    ? `${API_BASE_URL}/video-info`
    : `${API_BASE_URL}/fetch-info`;
    
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
};
```

## 🔧 Development Workflow

### Start Both Services

**Option 1: Separate Terminals**
```bash
# Terminal 1 - Frontend (in this project)
npm run dev

# Terminal 2 - Backend (in backend directory)  
npm run dev
```

**Option 2: Concurrently (Recommended)**

In your backend `package.json`, add:
```json
{
  "scripts": {
    "dev:full": "concurrently \"npm run dev\" \"cd ../your-frontend-project && npm run dev\""
  }
}
```

Then run: `npm run dev:full`

## 🌐 Production Deployment

### Backend Deployment Options

**1. Railway (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**2. Heroku**
```bash
# Install Heroku CLI, then:
heroku create your-app-name
git push heroku main
```

**3. DigitalOcean App Platform**
- Connect your GitHub repository
- Select Node.js environment
- Set build command: `npm install`
- Set run command: `npm start`

### Update Production URLs

After deployment, update your Supabase Edge Functions environment variables with your production backend URL.

## 🔍 Testing Your Setup

### 1. Test Backend Directly

```bash
# Health check
curl http://localhost:3001/health

# Test video info
curl -X POST http://localhost:3001/api/video-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### 2. Test Through Frontend

1. Start both frontend and backend
2. Open http://localhost:8080
3. Paste a YouTube URL
4. Check browser dev tools for network requests

## ⚠️ Troubleshooting

### Common Issues

**1. CORS Errors**
- Ensure your frontend URL is in the CORS configuration
- Check that both servers are running on correct ports

**2. ytdl-core Issues**
- YouTube frequently changes their API
- Update ytdl-core regularly: `npm update ytdl-core`
- For persistent issues, consider alternatives like `youtube-dl-exec`

**3. Edge Function Timeouts**
- Large videos may timeout
- Implement streaming or chunked responses
- Consider background processing for large files

**4. Port Conflicts**
- Frontend: 8080 or 5173
- Backend: 3001
- Ensure no other services use these ports

### Debug Commands

```bash
# Check what's running on ports
lsof -i :3001
lsof -i :8080

# Monitor backend logs
npm run dev # Shows real-time logs

# Test with verbose curl
curl -v http://localhost:3001/health
```

## 📚 Additional Resources

- [ytdl-core Documentation](https://github.com/fent/node-ytdl-core)
- [Express.js Guide](https://expressjs.com/en/starter/hello-world.html)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [CORS Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Shadcn/ui components
- Lucide React icons

### Backend (To Implement)
- Node.js
- Express.js
- ytdl-core
- CORS

## Design System

The app uses a custom design system with:
- **Dark theme** with YouTube red accents
- **Glassmorphism effects** for modern UI
- **Smooth animations** and transitions
- **Responsive layout** for all devices

## Deployment

### Frontend Deployment
The frontend can be deployed to Vercel, Netlify, or any static hosting service.

### Backend Deployment
Deploy the backend to Railway, Heroku, or any Node.js hosting platform.

## License

MIT License