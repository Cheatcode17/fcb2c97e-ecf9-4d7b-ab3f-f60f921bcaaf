# YouTube Downloader

A modern, full-stack YouTube video and audio downloader with a beautiful React frontend and Node.js backend.

## Features

- 🎥 Download YouTube videos in multiple resolutions (144p - 1080p)
- 🎵 Extract audio as MP3 files
- 📱 Responsive, modern UI with glassmorphism design
- ⚡ Real-time progress tracking
- 🔍 Video information preview with thumbnails
- ✨ Beautiful animations and transitions

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

## Backend Integration (Node.js + Express)

**⚠️ Important:** This Lovable project includes only the frontend. You'll need to implement the backend separately.

### Recommended Backend Structure

```
server/
├── package.json
├── server.js
└── routes/
    └── download.js
```

### Backend Dependencies

```bash
npm init -y
npm install express cors ytdl-core
npm install -D nodemon
```

### Example Backend Implementation

**server.js:**
```javascript
const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const app = express();

app.use(cors());
app.use(express.json());

// Get video info
app.post('/api/video-info', async (req, res) => {
  try {
    const { url } = req.body;
    const info = await ytdl.getInfo(url);
    
    res.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[0].url,
      duration: info.videoDetails.lengthSeconds,
      author: info.videoDetails.author.name,
      views: info.videoDetails.viewCount
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid YouTube URL' });
  }
});

// Download endpoint
app.post('/api/download', async (req, res) => {
  try {
    const { url, type, quality } = req.body;
    
    if (type === 'audio') {
      const stream = ytdl(url, { 
        filter: 'audioonly',
        format: 'mp3'
      });
      res.header('Content-Disposition', 'attachment; filename="audio.mp3"');
      stream.pipe(res);
    } else {
      const stream = ytdl(url, {
        filter: format => format.container === 'mp4' && format.qualityLabel === quality
      });
      res.header('Content-Disposition', 'attachment; filename="video.mp4"');
      stream.pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

app.listen(3001, () => {
  console.log('Backend running on port 3001');
});
```

### Running the Backend

```bash
# In your server directory
node server.js
# or with nodemon for development
npx nodemon server.js
```

## Frontend-Backend Integration

Update the API calls in `YouTubeDownloader.tsx`:

```typescript
// Replace the mock API calls with real ones:
const fetchVideoInfo = async () => {
  const response = await fetch('http://localhost:3001/api/video-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  const data = await response.json();
  setVideoInfo(data);
};

const handleDownload = async () => {
  const response = await fetch('http://localhost:3001/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: downloadType, quality })
  });
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `download.${downloadType === 'audio' ? 'mp3' : 'mp4'}`;
  link.click();
};
```

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