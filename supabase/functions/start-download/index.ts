import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method === 'GET') {
      // Stream directly to the user
      const urlObj = new URL(req.url)
      const url = urlObj.searchParams.get('url') || ''
      const format = (urlObj.searchParams.get('format') || 'video') as 'audio' | 'video'
      const resolution = urlObj.searchParams.get('resolution') || '360p'
      const filename = urlObj.searchParams.get('filename') || undefined

      const streamResponse = await prepareAndStream(url, format, resolution, filename)
      return streamResponse
    }

    // POST -> return a link that the frontend can open to start the stream
    const { url, format, resolution } = await req.json()

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reqUrl = new URL(req.url)
    const direct = new URL(reqUrl.toString())
    direct.searchParams.set('url', url)
    direct.searchParams.set('format', (format || 'video'))
    if (resolution) direct.searchParams.set('resolution', resolution)

    // Optional filename hint
    try {
      const id = extractVideoId(url)
      if (id) {
        const baseName = `youtube_${id}_${format === 'video' ? (resolution || '360p') : 'audio'}`
        const ext = format === 'video' ? 'mp4' : 'm4a'
        direct.searchParams.set('filename', `${baseName}.${ext}`)
      }
    } catch {}

    return new Response(
      JSON.stringify({ success: true, data: { downloadUrl: direct.toString() } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('start-download error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to start download' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function extractVideoId(url: string): string | null {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function prepareAndStream(url: string, format: 'audio' | 'video', resolution?: string, filename?: string) {
  const videoId = extractVideoId(url)
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Map resolution to muxed MP4 itags via Invidious /latest_version
  // Common muxed options: 22 -> 720p mp4, 18 -> 360p mp4; 140 -> m4a audio
  let itag = 18
  let mime = 'video/mp4'
  if (format === 'audio') {
    itag = 140
    mime = 'audio/mp4'
  } else if (resolution === '720p') {
    itag = 22
  } else if (resolution === '360p' || !resolution) {
    itag = 18
  } else {
    // Fallback: try 22 then 18
    itag = 22
  }

  const instances = [
    'https://yewtu.be',
    'https://invidious.flokinet.to',
    'https://inv.n8n.works',
  ]

  let lastErr: unknown = null
  for (const base of instances) {
    try {
      const upstream = `${base}/latest_version?id=${videoId}&itag=${itag}`
      const upstreamResp = await fetch(upstream)
      if (!upstreamResp.ok) {
        // Try fallback itag for video
        if (format === 'video' && itag === 22) {
          const fallback = await fetch(`${base}/latest_version?id=${videoId}&itag=18`)
          if (fallback.ok) return streamWithHeaders(fallback, filename || `youtube_${videoId}_${resolution || '360p'}.mp4`, mime)
        }
        lastErr = new Error(`${base} responded ${upstreamResp.status}`)
        continue
      }
      return streamWithHeaders(upstreamResp, filename || defaultFileName(videoId, format, resolution), mime)
    } catch (e) {
      lastErr = e
      continue
    }
  }

  console.error('All invidious instances failed', lastErr)
  return new Response(JSON.stringify({ error: 'All download services are currently unavailable' }), {
    status: 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function defaultFileName(videoId: string, format: 'audio' | 'video', resolution?: string) {
  const ext = format === 'video' ? 'mp4' : 'm4a'
  const res = format === 'video' ? (resolution || '360p') : 'audio'
  return `youtube_${videoId}_${res}.${ext}`
}

function streamWithHeaders(resp: Response, filename: string, mime: string) {
  // Proxy the upstream stream to the client with proper headers
  const headers = new Headers(resp.headers)
  headers.set('Content-Type', mime)
  headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v as string)
  return new Response(resp.body, { status: 200, headers })
}
