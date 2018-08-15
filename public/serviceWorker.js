importScripts('/src/js/idb.js');
importScripts('/src/js/dataBase.js');

const VERSION = '14';
const STATIC_CACHE = 'STATIC_v-' + VERSION;
const DYNAMIC_CACHE = 'DYNAMIC_v-' + VERSION;
const STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html',
    '/src/js/material.min.js',
    '/src/js/idb.js',
    '/src/js/app.js',
    '/src/js/feed.js',
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/css/help.css',
    '/src/images/main-image.jpg',
    '/src/images/main-image-lg.jpg',
    '/src/images/main-image-sm.jpg',
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
    'https://fonts.googleapis.com/css?family=Roboto:400,700',
    'https://fonts.googleapis.com/icon?family=Material+Icons'
];

function trimCacheStrategy(cache, keys) {
    const MAX_STORE_ELEMENTS = 10;
    if (keys.length > MAX_STORE_ELEMENTS) {
        return cache.delete(keys[0]).then(trimCache);
    }
}

function trimCache() {
    caches.open(DYNAMIC_CACHE).then(function (cache) {
        return cache.keys().then(function (keys) {
            return trimCacheStrategy(cache, keys)
        })
    })
}

function handleError(message, error){
    console.log('[SW] Error: ' + message, error);
}

function isStaticFile(url){
    let cachePath = url;
    if (url.indexOf(self.origin) === 0) {
        // request targets domain where we serve the page from (i.e. NOT a CDN)
        cachePath = url.substring(self.origin.length);
    }
    return STATIC_FILES.indexOf(cachePath) > -1;
}

function activateServiceWorker(event) {
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
    );
    return self.clients.claim();
}

function installServiceWorker(event) {
    console.log('[SW] Installation complete! ', event);
    /**
     * Cache main static assets during installation
     */
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(function(cache) {
                console.log('[SW] Caching app shell');
                cache.addAll(STATIC_FILES);
            })
    );
}

function dynamicCacheHandler(event, response) {
    return caches.open(DYNAMIC_CACHE)
        .then(function (cache) {
            cache.put(event.request.url, response.clone());
            return response;
        })
}

function networkFirstStrategy(event) {
    return event.respondWith(
        fetch(event.request)
            .then(function(resp) {
                return dynamicCacheHandler(event, resp)
            })
            .catch(error => caches.match(event.request))
    )
}

function cacheFirstStrategy(event) {
    /**
     * This will work onl for browser fetching or fetch function.
     * NOTE: standard XmlHttpRequest will NOT trigger this event!
     */
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                return response ? response : fetch(event.request).then(function (resp) {
                    return dynamicCacheHandler(event, resp).catch(function(error){
                        handleError('You are offline!', error);
                    })
                });
            })
            .catch(function(error) {
                console.log('[SW] Failed to cache!', error);
                return caches.open(STATIC_CACHE).then(function(cache){
                    // Return dummy page only in case that user requested a page some other files
                    if (event.request.headers.get('accept').includes('text/html')) {
                        // TODO: update this to avoid inconvenience with 404 state
                        return cache.match('/offline.html');
                    }
                })
            })
    );
}

function cacheThanNetworkStrategy(event) {
    event.respondWith(
        caches.open(DYNAMIC_CACHE).then(function(cache) {
            return fetch(event.request).then(function(response) {
                cache.put(event.request, response.clone());
                return response;
            })
        })
    )
}

function cacheOnlyStrategy(event) {
    event.respondWith(
        caches.match(event.request)
    )
}

function storePost(post) {
    return removeAllData('posts').then(function() {
        return writeData('posts', post);
    });

}

function indexedDBStrategy(event){
    return event.respondWith(fetch(event.request).then(function(response) {
        const responseCopy = response.clone();
        responseCopy.json().then(function(data) {
            Object.keys(data).forEach(keyName => storePost(data[keyName]));
        });
        return response;
    }))
}

self.addEventListener('install', installServiceWorker);

self.addEventListener('activate', activateServiceWorker);

self.addEventListener('fetch', function (event) {
    const url = 'https://my-pwagram.firebaseio.com/posts.json';
    trimCache();
    if (event.request.url.indexOf(url) > -1){
        return indexedDBStrategy(event);
        // return cacheThanNetworkStrategy(event);
    } else if (isStaticFile(event.request.url)) {
        return cacheOnlyStrategy(event);
    } else {
        return cacheFirstStrategy(event);
    }
});


