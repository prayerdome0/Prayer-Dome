'use strict';

/**
 * Radio & Podcasts API endpoint.
 * Returns all radio stations and podcast episodes as JSON.
 * Used by /radio.html and any external consumer.
 */

var DEFAULT_RADIO = (typeof window !== 'undefined' && window.PD_CONTENT && window.PD_CONTENT.DEFAULT_RADIO)
  ? window.PD_CONTENT.DEFAULT_RADIO
  : [];
var DEFAULT_PODCASTS = (typeof window !== 'undefined' && window.PD_CONTENT && window.PD_CONTENT.DEFAULT_PODCASTS)
  ? window.PD_CONTENT.DEFAULT_PODCASTS
  : [];

function getRadio() {
  if (typeof module !== 'undefined' && module.exports) return DEFAULT_RADIO;
  try {
    var store = window.PDApp && window.PDApp.store;
    if (store) return store.get('radio', 'DEFAULT_RADIO') || DEFAULT_RADIO;
  } catch (e) { /* fall through */ }
  return DEFAULT_RADIO;
}

function getPodcasts() {
  if (typeof module !== 'undefined' && module.exports) return DEFAULT_PODCASTS;
  try {
    var store = window.PDApp && window.PDApp.store;
    if (store) return store.get('podcasts', 'DEFAULT_PODCASTS') || DEFAULT_PODCASTS;
  } catch (e) { /* fall through */ }
  return DEFAULT_PODCASTS;
}

function serializeRadio(item) {
  return {
    id: item.id || '',
    name: item.name || '',
    tagline: item.tagline || '',
    streamUrl: item.streamUrl || '',
    icon: item.icon || 'fa-tower-broadcast'
  };
}

function serializePodcast(item) {
  return {
    id: item.id || '',
    title: item.title || '',
    series: item.series || '',
    description: item.description || '',
    audioUrl: item.audioUrl || '',
    duration: item.duration || '',
    date: item.date ? (typeof item.date === 'string' ? item.date : item.date.toISOString()) : null
  };
}

function handler(req, res) {
  var body = JSON.stringify({
    success: true,
    radio: getRadio().map(serializeRadio),
    podcasts: getPodcasts().map(serializePodcast)
  }, null, 2);

  if (res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(body);
  }
  return body;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.handler = handler;
}
