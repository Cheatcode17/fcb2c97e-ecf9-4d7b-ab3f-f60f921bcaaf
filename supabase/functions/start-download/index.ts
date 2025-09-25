import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, format, resolution } = await req.json()

    // Validate inputs
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!format || !['audio', 'video'].includes(format)) {
      return new Response(
        JSON.stringify({ error: 'Format must be either "audio" or "video"' }),
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

    console.log(`Starting download: ${format} ${resolution || 'default'} for video ${videoId}`)

    // Try primary download service
    try {
      const downloadUrl = format === 'video' 
        ? `https://api.apiyt.com/download/mp4?url=https://www.youtube.com/watch?v=${videoId}&quality=${resolution || '720p'}`
        : `https://api.apiyt.com/download/mp3?url=https://www.youtube.com/watch?v=${videoId}`

      const downloadResponse = await fetch(downloadUrl)
      
      if (!downloadResponse.ok) {
        throw new Error(`Primary service error: ${downloadResponse.status}`)
      }

      const downloadData = await downloadResponse.json()
      
      if (downloadData.success && downloadData.download_url) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            downloadUrl: downloadData.download_url,
            filename: downloadData.filename || `youtube_${videoId}_${format === 'video' ? resolution : 'audio'}.${format === 'video' ? 'mp4' : 'mp3'}`,
            fileSize: downloadData.file_size || 'Unknown',
            message: 'Download stream ready'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      } else {
        throw new Error('Primary service did not return valid download URL')
      }

    } catch (primaryError) {
      console.log('Primary download service failed, trying backup...', primaryError)
      
      // Backup service 1
      try {
        const backupResponse = await fetch(`https://yt-mp3s.me/api/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            format: format === 'video' ? 'mp4' : 'mp3',
            quality: format === 'video' ? resolution : '192'
          })
        })

        if (backupResponse.ok) {
          const backupData = await backupResponse.json()
          if (backupData.download_url) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                downloadUrl: backupData.download_url,
                filename: `youtube_${videoId}_${format === 'video' ? resolution : 'audio'}.${format === 'video' ? 'mp4' : 'mp3'}`,
                message: 'Download stream ready (backup service)'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
        }
      } catch (backup1Error) {
        console.log('Backup service 1 failed:', backup1Error)
      }

      // Backup service 2 - Alternative approach
      try {
        const altBackupResponse = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
          headers: {
            'X-RapidAPI-Key': 'demo', // Using demo key, should be replaced with real key
            'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
          }
        })

        if (altBackupResponse.ok) {
          const altData = await altBackupResponse.json()
          if (altData.link) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                downloadUrl: altData.link,
                filename: `youtube_${videoId}_audio.mp3`,
                message: 'Download stream ready (alternative backup)'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
        }
      } catch (backup2Error) {
        console.log('Backup service 2 failed:', backup2Error)
      }
      
      // If all services fail
      throw new Error('All download services are currently unavailable')
    }

  } catch (error) {
    console.error('Error starting download:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to start download' }),
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