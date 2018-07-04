self.addEventListener('install', function(event) {
   console.log('[SW] Installation complete! ', event);
});

self.addEventListener('activate', function(event) {
    console.log('[SW] Activation complete! ', event);
    return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    /**
     * This will work onl for browser fetching or fetch function.
     * NOTE: standard XmlHttpRequest will NOT trigger this event!
     */
    // console.log('[SW] Fetching... ', event);
});
