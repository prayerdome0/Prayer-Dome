// live-stream-config.js - Cloudinary Live Streaming Configuration
// Only browser-safe values belong in this file. Cloudinary API secrets must never
// be shipped to members; keep the existing configuration names for compatibility
// and provide apiSecret from a server-side environment when an authenticated
// Cloudinary API operation is required.

export const CLOUDINARY_CONFIG = {
    cloudName: 'prayerdome',
    uploadPreset: 'live_streams',
    apiKey: '817426214225458',
    apiSecret: ''
};

export const STREAM_QUALITIES = {
    '360p': { width: 640, height: 360, bitrate: 800000 },
    '480p': { width: 854, height: 480, bitrate: 1200000 },
    '720p': { width: 1280, height: 720, bitrate: 2500000 },
    '1080p': { width: 1920, height: 1080, bitrate: 4500000 }
};

export function getCloudinaryRTMPUrl(streamKey) {
    return `rtmp://api.cloudinary.com/v2/prayerdome/live/${streamKey}`;
}

export function getCloudinaryHLSStream(streamName) {
    return `https://res.cloudinary.com/prayerdome/video/upload/hls/${streamName}.m3u8`;
}
