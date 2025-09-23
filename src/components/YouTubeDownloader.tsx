import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Music, Video, ExternalLink } from 'lucide-react';

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
  views: string;
}

const YouTubeDownloader = () => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadType, setDownloadType] = useState('video');
  const [quality, setQuality] = useState('720p');
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { toast } = useToast();

  const validateYouTubeUrl = (url: string) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a YouTube URL",
        variant: "destructive"
      });
      return;
    }

    if (!validateYouTubeUrl(url)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('https://lwptyzfpqdzefyiovmjr.supabase.co/functions/v1/youtube-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cHR5emZwcWR6ZWZ5aW92bWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NTIwNjAsImV4cCI6MjA3NDIyODA2MH0.beOc0XDRoJ0tCVb9DifMedv5AC8-5ViWSd6TtWSerGw`
        },
        body: JSON.stringify({ url })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch video info');
      }

      if (result.success) {
        setVideoInfo(result.data);
        toast({
          title: "Video Found!",
          description: "Video information loaded successfully"
        });
      } else {
        throw new Error(result.error || 'Failed to fetch video info');
      }
    } catch (error) {
      console.error('Error fetching video info:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch video information",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) {
      toast({
        title: "No Video Selected",
        description: "Please fetch video information first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setDownloadProgress(0);

    try {
      const response = await fetch('https://lwptyzfpqdzefyiovmjr.supabase.co/functions/v1/youtube-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cHR5emZwcWR6ZWZ5aW92bWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NTIwNjAsImV4cCI6MjA3NDIyODA2MH0.beOc0XDRoJ0tCVb9DifMedv5AC8-5ViWSd6TtWSerGw`
        },
        body: JSON.stringify({ 
          url, 
          type: downloadType, 
          quality: downloadType === 'video' ? quality : undefined 
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Download failed');
      }

      // Simulate progress for demo purposes
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsLoading(false);
            toast({
              title: "Download Prepared!",
              description: `${downloadType === 'video' ? 'Video' : 'Audio'} download ready`,
            });
            return 100;
          }
          return prev + 20;
        });
      }, 200);

    } catch (error) {
      console.error('Error downloading:', error);
      setIsLoading(false);
      setDownloadProgress(0);
      toast({
        title: "Download Error",
        description: error instanceof Error ? error.message : "Failed to prepare download",
        variant: "destructive"
      });
    }
  };

  const clearForm = () => {
    setUrl('');
    setVideoInfo(null);
    setDownloadProgress(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl glass-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-youtube/20">
              <Video className="w-8 h-8 text-youtube" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-youtube to-youtube/80 bg-clip-text text-transparent">
              YouTube Downloader
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Download YouTube videos and audio with ease
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* URL Input Section */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Paste YouTube URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-input/50 backdrop-blur-sm border-border/50"
                disabled={isLoading}
              />
              <Button 
                onClick={fetchVideoInfo}
                disabled={isLoading || !url.trim()}
                variant="youtube-secondary"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Fetch
              </Button>
            </div>
            {url && !validateYouTubeUrl(url) && (
              <p className="text-sm text-destructive">Please enter a valid YouTube URL</p>
            )}
          </div>

          {/* Video Info Display */}
          {videoInfo && (
            <Card className="bg-secondary/30 border-border/30">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video thumbnail"
                    className="w-32 h-24 rounded-lg object-cover"
                  />
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-card-foreground line-clamp-2">
                      {videoInfo.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{videoInfo.author}</span>
                      <Badge variant="outline" className="text-xs">
                        {videoInfo.duration}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{videoInfo.views}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Options */}
          {videoInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Download Type</label>
                  <Select value={downloadType} onValueChange={setDownloadType}>
                    <SelectTrigger className="bg-input/50 backdrop-blur-sm border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          Video (MP4)
                        </div>
                      </SelectItem>
                      <SelectItem value="audio">
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4" />
                          Audio Only (MP3)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {downloadType === 'video' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quality</label>
                    <Select value={quality} onValueChange={setQuality}>
                      <SelectTrigger className="bg-input/50 backdrop-blur-sm border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="144p">144p (Low)</SelectItem>
                        <SelectItem value="360p">360p (Medium)</SelectItem>
                        <SelectItem value="720p">720p (HD)</SelectItem>
                        <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Download Progress */}
              {downloadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Downloading...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <Progress value={downloadProgress} className="loading-pulse" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleDownload}
                  disabled={isLoading}
                  variant="youtube"
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download {downloadType === 'video' ? `(${quality})` : '(MP3)'}
                </Button>
                <Button
                  onClick={clearForm}
                  variant="outline"
                  disabled={isLoading}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Backend Integration Note */}
          <Card className="bg-muted/30 border-border/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-youtube/20 mt-1">
                  <ExternalLink className="w-4 h-4 text-youtube" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Backend Integration Required</h4>
                  <p className="text-xs text-muted-foreground">
                    This frontend is ready to connect to your Node.js + Express backend. 
                    The API endpoints should handle video fetching and download processing using ytdl-core.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default YouTubeDownloader;