var deferredPrompt;

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