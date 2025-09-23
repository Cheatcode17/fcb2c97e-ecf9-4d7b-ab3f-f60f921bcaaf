import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, type, quality } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Extract video ID
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

    // For this demo, we'll return a download URL that would work with a proper YouTube downloading service
    // In a production environment, you'd use ytdl-core or similar library
    // Note: Direct YouTube downloading may violate YouTube's Terms of Service
    
    const downloadInfo = {
      videoId,
      type,
      quality: type === 'video' ? quality : 'audio',
      filename: `youtube_${videoId}_${type === 'video' ? quality : 'audio'}.${type === 'video' ? 'mp4' : 'mp3'}`,
      // This would be replaced with actual download stream in production
      downloadUrl: `#download-${videoId}-${type}-${quality}`,
      message: 'Download preparation complete'
    }

    return new Response(
      JSON.stringify({ success: true, data: downloadInfo }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error preparing download:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
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