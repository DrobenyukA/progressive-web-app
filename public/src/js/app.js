let deferredPrompt;
const enableNotificationsBtns = document.querySelectorAll('.enable-notifications');
const PUBLIC_KEY = 'BPwh4ZAP3RaLN1bpxMP9s9k97y6UgiSCf56sxmNK-R4CC_jJI0SUi04e96Af1U4edoyGIlWMmTm9b9tG2VoMmd0';

function supportServiceWorker() {
    return 'serviceWorker' in navigator;
}

function supportNotification() {
    return 'Notification' in window;
}

function unregisterServiceWorker() {
    if (supportServiceWorker()) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for(let i = 0; i >= registrations.length; i++) {
                registrations[i].unregister();
            }
        })
    }
}

function displayConfirmNotification() {
    const options = {
        body: 'You successfully subscribed to our notification service',
        icon: '/src/images/icons/app-icon-96x96.png',
        image: 'https://1434697713.rsc.cdn77.org/assets/uploads/2018/05/04/camera.jpg',
        dir: 'ltr', // or rtl
        lang: 'en-US',  //BCP 47
        vibrate: [100, 50, 200, 20, 100],
        badge: '/src/images/icons/app-icon-96x96.png',
        tag: 'confirm-notification',
        renotify: true,
        actions: [
            {action: 'confirm', title: 'Confirm title', icon: '/src/images/icons/app-icon-96x96.png'},
            {action: 'cancel', title: 'Cancel title', icon: '/src/images/icons/app-icon-96x96.png'}
        ]
    };
    const title = 'Permission granted';
    if (supportServiceWorker()) {
        navigator.serviceWorker.ready.then(serviceWorkerRegistration => {
            serviceWorkerRegistration.showNotification(title, options);
        });
    } else {
        new Notification(title, options);
    }
}


function configurePushSubscription() {
    let sWRegistration;
    if (supportServiceWorker()) {
        navigator.serviceWorker.ready
        .then(sWReg => {
            sWRegistration = sWReg;
            return sWReg.pushManager.getSubscription();
        })
        .then(subscription => {
            console.log('Subscription: ', subscription);
            if (subscription) {
                // Use it to some actions
            } else {
                return sWRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
                });
            }
        })
        .then(subscription => {
            // TODO: debug why firebase do not store it
            fetch('https://my-pwagram.firebaseio.com/subscriptions.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(subscription)
            })
                .then(resp => {
                    if (resp.ok) {
                        displayConfirmNotification();
                    } 
                })
                .catch((error) => console.log('Failed to store subscription', error));
        })
    } else {
        console.log('Your browser do not support service workers')
    }
    
}

function handleNotificationSubscription(event) {
    Notification.requestPermission((result) => {
        if (result !== 'granted') {
            enableNotificationsBtns.forEach(btn => btn.style.display = 'none');
        } else {
            configurePushSubscription();
            // displayConfirmNotification();
        }
    });
}

if (supportServiceWorker()) {
    navigator.serviceWorker.register('/service-worker.js')
        .then((event) => {
            console.log('Service worker registered successfully! ', event);
        })
        .catch((error) => {
            console.log('Service worker registration failed! ', error);
        });
}

if (supportNotification() && supportServiceWorker()) {
    enableNotificationsBtns.forEach( (btn) => {
        btn.style.display = 'inline-block';
        btn.addEventListener('click', handleNotificationSubscription);
    });
}

window.addEventListener('beforeinstallprompt', (event)  => {
    console.log('User comes to our page in 5 minutes after his first visit.', event);
});