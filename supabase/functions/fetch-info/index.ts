import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
  views: string;
  videoId: string;
  formats: Array<{
    quality: string;
    format: string;
    type: 'video' | 'audio';
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    // Validate YouTube URL
    if (!url || !isValidYouTubeUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing YouTube URL' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Fetching info for URL: ${url}`)

    // Extract video ID
    const videoId = extractVideoId(url)
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract video ID from URL' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Try primary video info service
    let metadata: VideoMetadata;
    
    try {
      const apiResponse = await fetch(`https://api.apiyt.com/info?url=https://www.youtube.com/watch?v=${videoId}`)
      
      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        metadata = {
          title: apiData.title || 'Unknown Title',
          thumbnail: apiData.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: formatDuration(apiData.duration) || 'Unknown',
          author: apiData.author || 'Unknown Channel',
          views: formatViews(apiData.view_count) || 'Unknown',
          videoId,
          formats: generateAvailableFormats()
        }
      } else {
        throw new Error('Primary service failed')
      }
    } catch (primaryError) {
      console.log('Primary service failed, trying backup...')
      
      // Fallback to oEmbed API
      const oembedResponse = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )

      if (!oembedResponse.ok) {
        throw new Error('Video not found or unavailable')
      }

      const oembedData = await oembedResponse.json()
      metadata = {
        title: oembedData.title,
        thumbnail: oembedData.thumbnail_url,
        duration: 'Unknown',
        author: oembedData.author_name,
        views: 'Unknown',
        videoId,
        formats: generateAvailableFormats()
      }
    }

    return new Response(
      JSON.stringify({ success: true, metadata }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error fetching video info:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch video information' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/).+/,
  ]
  return patterns.some(pattern => pattern.test(url))
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

function formatDuration(seconds: number): string {
  if (!seconds) return 'Unknown'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatViews(views: number): string {
  if (!views) return 'Unknown'
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`
  }
  return `${views} views`
}

function generateAvailableFormats() {
  return [
    { quality: '1080p', format: 'mp4', type: 'video' as const },
    { quality: '720p', format: 'mp4', type: 'video' as const },
    { quality: '480p', format: 'mp4', type: 'video' as const },
    { quality: '360p', format: 'mp4', type: 'video' as const },
    { quality: 'high', format: 'mp3', type: 'audio' as const },
    { quality: 'medium', format: 'mp3', type: 'audio' as const },
  ]
}