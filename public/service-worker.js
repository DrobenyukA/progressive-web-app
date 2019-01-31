// Path should starts from root of application
importScripts('workbox-sw.prod.v2.1.3.js');
importScripts('/src/js/idb.js');
importScripts('/src/js/dataBase.js');

const URLS = {
    POSTS: 'https://my-pwagram.firebaseio.com/posts.json',
    MATERIAL_ICONS: 'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
};
const workboxSW = new self.WorkboxSW();
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const DYNAMIC_CACHE = 'dynamic';

function dynamicCacheHandler(event, response) {
    return caches.open(DYNAMIC_CACHE)
        .then(cache => {
            cache.put(event.request.url, response.clone());
            return response;
        })
        .catch(err => console.log('[SW] Failed to get data from cache: ', err));
}

function getHtmlFallback(event) {
    return caches.match(event.request)
    .then(response => response 
            ? response 
            : fetch(event.request)
                .then(resp => dynamicCacheHandler(event, resp)
                .catch(error => console.log('[SW] You are offline: ', error))
        )
    )
    .catch(error => {
        console.log('[SW] Failed to cache!', error);
        return caches.match('/offline.html')
            .then(fallbackTemplate => fallbackTemplate)
            .catch(err => console.log('[SW] There is no fallback template in cache: ', err));
    })
}

function isFetchingHtmlContent(routeData) {
    return !!(routeData.event.request.headers.get('accept').includes('text/html'));
}

function storePost(post) {
    return writeData('posts', post)
    .then(result => console.log('[SW] Post is stored: ', result))
    .catch(error => console.log('[SW] Failed to store post: ', error));
}

function indexedDBStrategy(event) {
    return fetch(event.request)
    .then((response) => {
        const responseCopy = response.clone();
        removeAllData('posts')
            .then(() => responseCopy.json())
            .then(posts => {
                if (posts) {
                    Object.keys(posts).forEach(keyName => storePost({
                        id: keyName,
                        picture: posts[keyName].picture,
                        location: posts[keyName].location,
                        title: posts[keyName].title
                    }));
                }
            })
            .catch(err => console.log('[SW] Failed to store posts: ' , err));
        return response;
    })
    .catch(err => console.log('[SW] Failed to fetch posts: ', err))
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

function sendPost(post) {
    console.log('[SW] Post to send: ', post);
    const data = new FormData();
    data.append('syncId', post.syncId);
    data.append('title', post.title);
    data.append('location', post.location);
    data.append('file', post.picture, post.syncId + '.png');

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
        readAll('sync-posts')
            .then(posts => {
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

function handleBackgroundSync(event) {
    console.log('[SW] Background sync: ', event);
    switch (event.tag) {
        case 'store-new-post': return uploadStoredPosts(event);
        default: return console.log('[SW] There is no correct handler for tag: ', event.tag);
    }
}

workboxSW.router.registerRoute(
    new RegExp(/.*(?:googleapis|gstatic)\.com.*$/),
    workboxSW.strategies.staleWhileRevalidate({
        cacheName: 'google-public-api',
    })
);

workboxSW.router.registerRoute(
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
    workboxSW.strategies.staleWhileRevalidate({
        cacheName: 'material-design-icons',
    })
);

workboxSW.router.registerRoute(
    new RegExp(/.*(?:firebasestorage\.googleapis)\.com.*$/),
    workboxSW.strategies.staleWhileRevalidate({
        cacheName: 'posted-images',
    })
);

workboxSW.router.registerRoute(
    URLS.POSTS,
    (args) => indexedDBStrategy(args.event),
);

workboxSW.router.registerRoute(
    isFetchingHtmlContent,
    (args) => getHtmlFallback(args.event),
);

workboxSW.precache([
  {
    "url": "404.html",
    "revision": "0a27a4163254fc8fce870c8cc3a3f94f"
  },
  {
    "url": "favicon.ico",
    "revision": "2cab47d9e04d664d93c8d91aec59e812"
  },
  {
    "url": "index.html",
    "revision": "fa355a8d4e3568a0f629be825c72b0d9"
  },
  {
    "url": "manifest.json",
    "revision": "2d1eb0eb8587ab5fcaa80965e23e4c34"
  },
  {
    "url": "offline.html",
    "revision": "716a450b1c6d85ee8aba15b91bb51c79"
  },
  {
    "url": "service-worker.js",
    "revision": "f6d918f66eefe747be42a9fade389c0c"
  },
  {
    "url": "src/css/app.css",
    "revision": "0ba434741e4a6f42c44a6f8becd45cda"
  },
  {
    "url": "src/css/feed.css",
    "revision": "d4266e964288e79b12dc45b928894d06"
  },
  {
    "url": "src/css/help.css",
    "revision": "1c6d81b27c9d423bece9869b07a7bd73"
  },
  {
    "url": "src/images/main-image-lg.jpg",
    "revision": "31b19bffae4ea13ca0f2178ddb639403"
  },
  {
    "url": "src/images/main-image-sm.jpg",
    "revision": "c6bb733c2f39c60e3c139f814d2d14bb"
  },
  {
    "url": "src/images/main-image.jpg",
    "revision": "5c66d091b0dc200e8e89e56c589821fb"
  },
  {
    "url": "src/images/sf-boat.jpg",
    "revision": "0f282d64b0fb306daf12050e812d6a19"
  },
  {
    "url": "src/js/app.js",
    "revision": "f20f933f7bcd9233b836ed5d57eddaa0"
  },
  {
    "url": "src/js/dataBase.js",
    "revision": "3acaf6f38bdcae4e49a1067a5dce9cb4"
  },
  {
    "url": "src/js/feed.js",
    "revision": "d3c5b77b85347f02e7ad67967e8c84a8"
  },
  {
    "url": "src/js/idb.js",
    "revision": "017ced36d82bea1e08b08393361e354d"
  },
  {
    "url": "src/js/material.min.js",
    "revision": "713af0c6ce93dbbce2f00bf0a98d0541"
  },
  {
    "url": "src/js/utils.js",
    "revision": "cbc0179c9760e5309e480d0f648e180a"
  },
  {
    "url": "workbox-sw.prod.v2.1.3.js",
    "revision": "a9890beda9e5f17e4c68f42324217941"
  }
]);

self.addEventListener('sync', handleBackgroundSync);

self.addEventListener('notificationclick', handleNotificationClick);

self.addEventListener('notificationclose', handleNotificationClose);

self.addEventListener('push', handlePushMessage);
