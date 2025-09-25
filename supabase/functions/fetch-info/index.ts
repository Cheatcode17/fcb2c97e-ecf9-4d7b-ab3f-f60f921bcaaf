import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface VideoMetadata {
  title: string
  thumbnail: string
  duration: string
  author: string
  views: string
  videoId: string
  formats: Array<{
    quality: string
    format: string
    type: 'video' | 'audio'
    itag: number
    container: string
  }>
}

serve(async (req) => {
  console.log('fetch-info called')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text()
    let body: any
    try {
      body = JSON.parse(bodyText)
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { url } = body as { url?: string }

    if (!url || !isValidYouTubeUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract video ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to get rich metadata from Invidious (no key required)
    let title = 'Unknown Title'
    let author = 'Unknown Channel'
    let duration = 'Unknown'
    let views = 'Unknown'
    let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

    try {
      const inv = await fetch(`https://yewtu.be/api/v1/videos/${videoId}`)
      if (inv.ok) {
        const invData = await inv.json()
        title = invData.title || title
        author = invData.author || author
        if (invData.lengthSeconds) duration = formatDuration(Number(invData.lengthSeconds))
        if (typeof invData.viewCount === 'number') views = formatViews(invData.viewCount)
        if (invData.videoThumbnails?.length) {
          const best = invData.videoThumbnails.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0]
          thumbnail = best?.url || thumbnail
        }
      } else {
        console.log('Invidious video API not ok:', inv.status)
      }
    } catch (e) {
      console.log('Invidious video API failed, falling back to oEmbed', e)
    }

    // Fallback to oEmbed if needed
    if (title === 'Unknown Title') {
      try {
        const oembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
        if (oembed.ok) {
          const oe = await oembed.json()
          title = oe.title || title
          author = oe.author_name || author
          thumbnail = oe.thumbnail_url || thumbnail
        }
      } catch {}
    }

    // Provide commonly available formats via Invidious latest_version (muxed MP4 and M4A audio)
    const formats: VideoMetadata['formats'] = [
      { quality: '720p', format: 'mp4', type: 'video', itag: 22, container: 'mp4' },
      { quality: '360p', format: 'mp4', type: 'video', itag: 18, container: 'mp4' },
      { quality: 'audio', format: 'm4a', type: 'audio', itag: 140, container: 'm4a' },
    ]

    const data: VideoMetadata = {
      title,
      thumbnail,
      duration,
      author,
      views,
      videoId,
      formats,
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('fetch-info error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch video information' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
  ]
  return patterns.some((p) => p.test(url))
}

function extractVideoId(url: string): string | null {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/]
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
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatViews(views: number): string {
  if (!views) return 'Unknown'
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`
  return `${views} views`
}
