/*
 * Prayer Dome Live Server Configuration
 * ---------------------------------------------------------------------------
 * Real one-to-many phone broadcasting needs a media server or live provider.
 * Put only browser-safe broker URLs here. Do NOT place provider secrets in this
 * file. Recommended production shape:
 *   - /api/live/whip creates/authorizes a WHIP publish session server-side
 *   - /api/live/whep creates/authorizes a WHEP playback session server-side
 *   - optional hlsUrl can be provided by the same service for fallback players
 *
 * Example:
 * window.PD_LIVE_SERVER = {
 *   enabled: true,
 *   whipEndpoint: '/api/live/whip',
 *   whepEndpoint: '/api/live/whep',
 *   hlsUrl: 'https://live.example.com/prayerdome/index.m3u8'
 * };
 */
(function (global) {
  'use strict';
  global.PD_LIVE_SERVER = Object.assign({
    enabled: false,
    whipEndpoint: '',
    whepEndpoint: '',
    hlsUrl: '',
    bearerToken: '',
    preferMediaServer: true
  }, global.PD_LIVE_SERVER || {});
})(typeof window !== 'undefined' ? window : this);
