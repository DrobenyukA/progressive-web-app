var deferredPrompt;

function unregisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for(let i = 0; i >= registrations.length; i++) {
                registrations[i].unregister();
            }
        })
    }
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/serviceWorker.js')
        .then(function(event) {
            console.log('Service worker registered successfully! ', event);
        })
        .catch(function(error){
            console.log('Service worker registration failed! ', error);
        });
}

window.addEventListener('beforeinstallprompt', function(event) {
    console.log('User comes to our page in 5 minutes after his first visit.', event);
});