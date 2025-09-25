import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
  views: string;
  videoId: string;
}

serve(async (req) => {
  console.log('YouTube Info function called')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Processing request:', req.method)
    const body = await req.text()
    console.log('Request body:', body)
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(body)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    
    const { url } = parsedBody

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url)
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Fetching from API:', `https://api.apiyt.com/info?url=https://www.youtube.com/watch?v=${videoId}`)
    
    // Use a reliable YouTube info API service
    const apiResponse = await fetch(`https://api.apiyt.com/info?url=https://www.youtube.com/watch?v=${videoId}`)
    
    console.log('API Response status:', apiResponse.status)
    
    let videoInfo: VideoInfo;
    
    if (apiResponse.ok) {
      const apiData = await apiResponse.json()
      console.log('API Data received:', apiData)
      videoInfo = {
        title: apiData.title || 'Unknown Title',
        thumbnail: apiData.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: formatDuration(apiData.duration) || 'Unknown',
        author: apiData.author || 'Unknown Channel',
        views: formatViews(apiData.view_count) || 'Unknown',
        videoId
      }
    } else {
      console.log('Primary API failed, trying fallback...')
      // Fallback to oEmbed API
      const oembedResponse = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )

      console.log('oEmbed Response status:', oembedResponse.status)

      if (!oembedResponse.ok) {
        throw new Error('Video not found or unavailable')
      }

      const oembedData = await oembedResponse.json()
      console.log('oEmbed Data received:', oembedData)
      videoInfo = {
        title: oembedData.title,
        thumbnail: oembedData.thumbnail_url,
        duration: 'Unknown',
        author: oembedData.author_name,
        views: 'Unknown',
        videoId
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: videoInfo }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error fetching video info:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch video information' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

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