// Vercel Speed Insights initialization
// This script initializes the Speed Insights tracking for the application.
// The actual tracking script will be loaded from Vercel's CDN.

(function() {
  // Initialize the Speed Insights queue
  window.si = window.si || function() {
    (window.siq = window.siq || []).push(arguments);
  };

  // Only load in production (when deployed on Vercel)
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
    return;
  }

  // Create and inject the tracking script
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.dataset.sdkn = '@vercel/speed-insights';
  script.dataset.sdkv = '2.0.0';
  
  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script. This is expected in local development.');
  };

  document.head.appendChild(script);
})();
