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

workboxSW.precache([]);

self.addEventListener('sync', handleBackgroundSync);

self.addEventListener('notificationclick', handleNotificationClick);

self.addEventListener('notificationclose', handleNotificationClose);

self.addEventListener('push', handlePushMessage);
