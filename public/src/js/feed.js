const MY_API_KEY = undefined;
const shareImageButton = document.querySelector('#share-image-button');
const createPostArea = document.querySelector('#create-post');
const closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
const form = document.querySelector('form');
const sharedMomentsArea = document.querySelector('#shared-moments');
const snackBar = document.querySelector('#confirmation-toast');
const videoPlayer = document.querySelector('#player');
const imagePreview = document.querySelector('#canvas'); // old canvas
const captureBtn = document.querySelector('#capture-btn');
const imagePicker = document.querySelector('#image-picker');
const imageContainer = document.querySelector('#pick-image');
const locationInput = document.querySelector('#location');
const titleInput = document.querySelector('#title');
const locationBtn = document.querySelector('#location-btn');
const locationLoader = document.querySelector('#location-loader');

let networkDataReceived = false;
let pictureBlob;
let position;

function errorHandler(error) {
    console.log('[Page] ERROR:', error);
}

function stopVideo(video) {
    if (video && video.srcObject) {
        video.srcObject
            .getTracks()
            .forEach(track => track.stop());
    }
}

function onCaptureImage(event) {
    const context = imagePreview.getContext('2d');
    const top = 0;
    const left = 0;
    const width = imagePreview.width;
    // to keep aspect ratio
    const height = videoPlayer.videoHeight / (videoPlayer.videoWidth / imagePreview.width)

    videoPlayer.style.display = 'none';
    captureBtn.style.display = 'none';
    imagePreview.style.display = 'block';

    context.drawImage(videoPlayer, top, left, width, height);
    stopVideo(videoPlayer);
    pictureBlob = dataURItoBlob(imagePreview.toDataURL());
}

function setupUserMediaGetter(constraints) {
    // get media from old implementation;
    const getUserMedia = navigator.webKitGetUserMedia || navigator.mozGetUserMedia;
    if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented.'));
    }
    return new Promise((res, rej) => {
        getUserMedia.call(navigator, constraints, res, rej);
    })
}

function initializeMediaPicker() {
    if (!('mediaDevices' in navigator)) {
        navigator.mediaDevices = {};
    }

    if (!('getUserMedia' in navigator.mediaDevices)) {
        navigator.mediaDevices.getUserMedia = setupUserMediaGetter(constraints);
    }

    navigator.mediaDevices.getUserMedia({
            video: true,
            /* audio: true */
        })
        .then((stream) => {
            videoPlayer.srcObject = stream;
            videoPlayer.style.display = 'block';
        })
        .catch((error) => {
            console.log(error, error.message);
            imageContainer.style.display = 'block';
            captureBtn.style.display = 'none';
        })
}

function initializeLocationPicker() {
    if (!('geolocation' in navigator)) {
        locationBtn.style.display = 'none';
    }
}

function openCreatePostModal() {
    captureBtn.style.display = 'inline-block';
    createPostArea.style.transform = 'translateY(0)';
    initializeMediaPicker();
    initializeLocationPicker();
    if (deferredPrompt) {

        /**
         * Show user prompt with suggestion to add our app to home screen
         */
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (result) {

            console.log("User choose: ", result);
            if (result.outcome === "dismissed") {
                console.log('User closed our prompt.')
            } else {
                console.log('User added out app to home screen.')
            }
            deferredPrompt = null

        });
    }

}

function getDataFromCache(url) {
    if ('caches' in window) {
        return caches.match(url)
    }
    const errorMessage = 'Your browser doesn`t support caches';
    return new Promise(function (resolve, reject) {
        return reject({
            message: errorMessage
        })
    });

}

function closeCreatePostModal() {
    createPostArea.style.transform = 'translateY(100vh)';
    imageContainer.style.display = 'none';
    videoPlayer.style.display = 'none';
    imagePreview.style.display = 'none';
    locationBtn.style.display = 'inline-block';
    locationLoader.style.display = 'none';
    titleInput.value = '';
    locationInput.value = '';
    stopVideo(videoPlayer);
}

function removeCards() {
    while (sharedMomentsArea.hasChildNodes()) {
        sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
    }

}

function createCard(item) {
    const cardWrapper = document.createElement('div');

    cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
    const cardTitle = document.createElement('div');
    cardTitle.className = 'mdl-card__title';
    cardTitle.style.backgroundImage = 'url("' + item.picture + '")';
    cardTitle.style.backgroundSize = 'cover';
    cardTitle.style.height = '180px';

    cardWrapper.appendChild(cardTitle);
    const cardTitleTextElement = document.createElement('h2');
    cardTitleTextElement.className = 'mdl-card__title-text';
    cardTitleTextElement.textContent = item.title;

    cardTitle.appendChild(cardTitleTextElement);
    const cardSupportingText = document.createElement('div');
    cardSupportingText.className = 'mdl-card__supporting-text';
    cardSupportingText.textContent = item.location;
    cardSupportingText.style.textAlign = 'center';
    cardWrapper.appendChild(cardSupportingText);
    componentHandler.upgradeElement(cardWrapper);
    sharedMomentsArea.appendChild(cardWrapper);

}

function sendPost(post) {
    const data = new FormData();
    Object.keys(post).forEach(key => {
        if (key === 'picture') {
            data.append('file', post[key], post.id + '.png');
        }
        data.append(key, post[key]);
    });

    fetch('https://us-central1-my-pwagram.cloudfunctions.net/storePostData', {
            method: 'POST',
            body: data,
        })
        .then(resp => console.log('Post saved: ', resp))
        .catch(err => console.log('Failed to save post: ', err));
}

function syncPost(post) {
    post.syncId = new Date().toISOString();
    post.picture = pictureBlob;
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((sw) => {
            writeData(SYNC_POSTS, post).then(() => {
                return sw.sync.register('store-new-post');
            }).then(result => {
                snackBar.MaterialSnackbar.showSnackbar({
                    message: 'Your post saved for sync!'
                });
            }).catch(err => {
                console.log('Failed to store post: ', err);
            });

        });
    } else {
        sendPost(post);
    }
}

function onFormSubmit(event) {
    event.preventDefault();
    let isValid = true;
    const post = [
        event.currentTarget.querySelector('#title'),
        event.currentTarget.querySelector('#location'),
    ].reduce((result, element) => {
        const value = element.value;
        if (!value.trim()) {
            isValid = false;
            element.classList.add('error');
        } else {
            result[element.name] = element.value;
        }
        return result;
    }, {});

    if (isValid) {
        syncPost(post);
        return closeCreatePostModal();
    } else {
        return alert('Please enter valid data');
    }
}

fetch('https://my-pwagram.firebaseio.com/posts.json')
    .then(resp => resp.json())
    .then(results => Object.keys(results).map(keyName => ({
        id: keyName,
        picture: results[keyName].picture,
        location: results[keyName].location,
        title: results[keyName].title
    })))
    .then(data => {
        removeCards();
        [].forEach.call(data, (item) => createCard(item));
    })
    .catch(errorHandler);

if ('indexedDB' in window) {
    readAll('posts').then((data) => {
        if (!networkDataReceived && data.length) {
            console.log('FROM DB', data);
            [].forEach.call(data, (item) => createCard(item));
        }
    })
}

function getUserLocation(event) {
    if ('geolocation' in navigator) {
        locationBtn.style.display = 'none';
        locationLoader.style.display = 'block';
        navigator.geolocation.getCurrentPosition(
            location => {
                console.log('Users location', location);
                locationBtn.style.display = 'inline-block';
                locationLoader.style.display = 'none';
                locationInput.value = 'In Lviv';
                locationInput.parentElement.classList.add('is-focused');
            },
            error => {
                console.log('Can`t select users location. ', error);
                locationBtn.style.display = 'inline-block';
                locationLoader.style.display = 'none';
            },
            {
                timeout: 7 * 1000
            },
        )
    }
}

// getDataFromCache('https://httpbin.org/get')
//     .then(function(resp){
//         return resp.json();
//     })
//     .then(function(data){
//         if (networDataReceived){
//             return false;
//         } else {
//             console.log('From cache', data);
//             removeCards();
//             createCard('From cache');
//         }
//
//     })
//     .catch(errorHandler);

function uploadImage(event) {
    pictureBlob = event.target.files[0];
}

shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);
form.addEventListener('submit', onFormSubmit);
captureBtn.addEventListener('click', onCaptureImage);
imagePicker.addEventListener('change', uploadImage);
locationBtn.addEventListener('click', getUserLocation);