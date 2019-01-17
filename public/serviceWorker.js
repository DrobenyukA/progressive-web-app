importScripts('/src/js/idb.js');
importScripts('/src/js/dataBase.js');

const VERSION = '72';
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
    '/src/js/utils.js',
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
    return removeAllData('posts')
    .then(() => {
        console.log('[SW] Post to store:', post);
        return writeData('posts', post);
    }).catch(error => {
        console.log('[SW] Failed to store post', error);
    });

}

function indexedDBStrategy(event){
    return event.respondWith(fetch(event.request).then(function(response) {
        const responseCopy = response.clone();
        responseCopy.json().then(data => {
            console.log('Some data', data);
            if (data) {
                Object.keys(data).forEach(keyName => storePost({
                    id: keyName,
                    picture: data[keyName].picture,
                    location: data[keyName].location,
                    title: data[keyName].title
                }));
            }
        });
        return response;
    }))
}

function sendPost(post) {
    console.log('[SW] Post to send: ', post);
    const data = new FormData();
    // Object.keys(post).forEach(key => {
    //     if (key === 'picture') {
    //         data.append('file', post.picture, post.syncId + '.png');
    //     }
    //     data.append(key, post[key]);
    // });
    data.append('syncId', post.syncId);
    data.append('title', post.title);
    data.append('location', post.location);
    data.append('file', post.picture, post.syncId + '.png');

    // TODO: rename post.image onto post.file
    // TODO: find out how to set correct mime type
    return fetch('https://us-central1-my-pwagram.cloudfunctions.net/storePostData', {
        method: 'POST',
        body: data,
    }).then(resp => {
        console.log('[SW] Sync. Post saved: ', resp);
        if(resp.ok) {
            resp.json().then(function (resp) {
                console.log('Delete post id: ', resp.id);
                removeItem('sync-posts', resp.id);
            });
        }
    }).catch(function (err) {
        console.log('[SW] Sync. Failed to save post: ', err);
    });
}

function uploadStoredPosts(event) {
    console.log('[SW] store-new-post');
    return event.waitUntil(
        readAll('sync-posts').then(function (posts) {
            console.log('[SW] Posts to sync: ', posts);
            if (posts.length) {
                return [].forEach.call(posts, sendPost);
            } else {
                return sendPost(posts);
            }

        })
    )
}


function handleConfirmAction(notification) {
    console.log('[SW] You have successfully confirmed this action.');
    notification.close();
}

function goToAppPage(notification) {
    clients.matchAll()
        .then(openedTabs => openedTabs.find(tab => tab.visibilityState === 'visible'))
        .then(visibleTab => {
            if (visibleTab === undefined) {
                clients.openWindow(notification.data.url);
            } else {
                visibleTab.navigate(notification.data.url);
                visibleTab.focus();
            }
            notification.close();
        });
}

function handleNotificationClick (event) {
    const notification = event.notification;
    const action = event.action;

    console.log('[SW] Notification: ', notification);

    switch(action) {
        case 'confirm': return handleConfirmAction(notification);
        default: return event.waitUntil(goToAppPage(notification))
    }

}

function handleNotificationClose(event) {
    console.log('[SW] Notification closed!', event.notification);
}

function handlePushMessage(event) {
    console.log('[SW] Message received:', event);
    let data = { title: 'Hi', content: 'Something happened', openUrl: '/' };
    if (event.data) {
        data = JSON.parse(event.data.text())
    }
    const options = {
        body: data.content,
        icon: '/src/images/icons/app-icon-48x48.png',
        badge: '/src/images/icons/app-icon-48x48.png',
        data: {
            url: data.openUrl,
        }
    }
    event.waitUntil(
        self.registration.showNotification(data.title, options),
    )
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

self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync: ', event);
    switch (event.tag) {
        case 'store-new-post': return uploadStoredPosts(event);
        default: return console.log('[SW] There is no correct handler for tag: ', event.tag);
    }
});

self.addEventListener('notificationclick', handleNotificationClick);

self.addEventListener('notificationclose', handleNotificationClose);

self.addEventListener('push', handlePushMessage)
