const VERSION = '1';
self.addEventListener('install', function(event) {
   console.log('[SW] Installation complete! ', event);
    /**
     * Cache main static assets during installation
     */
    event.waitUntil(
        caches.open('static-' + VERSION)
            .then(function(cache) {
                console.log('[SW] Caching app shell');
                cache.addAll([
                    '/',
                    '/index.html',
                    '/src/js/app.js',
                    '/src/js/feed.js',
                    '/src/js/material.min.js',
                    '/src/css/app.css',
                    '/src/css/feed.css',
                    '/src/css/help.css',
                    '/src/images/main-image.jpg',
                    '/src/images/main-image-lg.jpg',
                    '/src/images/main-image-sm.jpg',
                    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
                    'https://fonts.googleapis.com/css?family=Roboto:400,700',
                    'https://fonts.googleapis.com/icon?family=Material+Icons'
                ]);
            })
    );
});

self.addEventListener('activate', function(event) {
    console.log('[SW] Activation complete! ', event);
    event.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(keyList.map(function (key) {
                const cacheVersion = key.split('-');
                if (cacheVersion[1] !== VERSION) {
                    console.log('[SW] Clean useless cache', key);
                    return caches.delete(key);
                }
            }))
        })
    )
    return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    /**
     * This will work onl for browser fetching or fetch function.
     * NOTE: standard XmlHttpRequest will NOT trigger this event!
     */
    // console.log('[SW] Fetching... ', event);
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                return response ? response : fetch(event.request).then(function (resp) {
                    return caches.open('dynamic-' + VERSION).then(function(cache) {
                        cache.put(event.request.url, resp.clone());
                        return resp;
                    }).catch(function(error){
                        console.log('[SW] You are offline!', error);
                    })
                });
            })
            .catch(function(error) {
                console.log('[SW] Failed to cache!', error);
            })
    );
});
