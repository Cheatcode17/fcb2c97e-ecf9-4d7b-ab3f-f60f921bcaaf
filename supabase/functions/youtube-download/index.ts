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

    console.log(`Processing download request: ${type} ${quality || 'audio'} for video ${videoId}`)

    try {
      // Use reliable YouTube download API service
      const downloadApiUrl = type === 'video' 
        ? `https://api.apiyt.com/download/mp4?url=https://www.youtube.com/watch?v=${videoId}&quality=${quality || '720p'}`
        : `https://api.apiyt.com/download/mp3?url=https://www.youtube.com/watch?v=${videoId}`

      const downloadResponse = await fetch(downloadApiUrl)
      
      if (!downloadResponse.ok) {
        throw new Error(`Download service error: ${downloadResponse.status}`)
      }

      const downloadData = await downloadResponse.json()
      
      if (downloadData.success && downloadData.download_url) {
        // Return the actual download URL from the service
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              videoId,
              type,
              quality: type === 'video' ? quality : 'audio',
              filename: downloadData.filename || `youtube_${videoId}_${type === 'video' ? quality : 'audio'}.${type === 'video' ? 'mp4' : 'mp3'}`,
              downloadUrl: downloadData.download_url,
              message: 'Download ready! Click to download to your device.',
              fileSize: downloadData.file_size || 'Unknown'
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else {
        throw new Error('Download service did not return a valid download URL')
      }

    } catch (apiError) {
      console.error('Primary API failed, trying backup service:', apiError)
      
      // Fallback to alternative service
      try {
        const backupApiUrl = `https://yt-mp3s.me/api/download`
        const backupResponse = await fetch(backupApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            format: type === 'video' ? 'mp4' : 'mp3',
            quality: type === 'video' ? quality : '192'
          })
        })

        if (backupResponse.ok) {
          const backupData = await backupResponse.json()
          if (backupData.download_url) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                data: {
                  videoId,
                  type,
                  quality: type === 'video' ? quality : 'audio',
                  filename: `youtube_${videoId}_${type === 'video' ? quality : 'audio'}.${type === 'video' ? 'mp4' : 'mp3'}`,
                  downloadUrl: backupData.download_url,
                  message: 'Download ready! Click to download to your device.'
                }
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
        }
      } catch (backupError) {
        console.error('Backup service also failed:', backupError)
      }
      
      // If all services fail, return error
      throw new Error('All download services are currently unavailable')
    }

  } catch (error) {
    console.error('Error preparing download:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
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