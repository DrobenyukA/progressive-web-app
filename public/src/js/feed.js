const shareImageButton = document.querySelector('#share-image-button');
const createPostArea = document.querySelector('#create-post');
const closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
const form = document.querySelector('form');
const sharedMomentsArea = document.querySelector('#shared-moments');
const snackBar = document.querySelector('#confirmation-toast');

shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);
form.addEventListener('submit', onFormSubmit);

let networkDataReceived = false;
function errorHandler(error){
    console.log('[Page] ERROR:', error);

}

function openCreatePostModal() {

    createPostArea.style.transform = 'translateY(0)';
    if (deferredPrompt) {

      /**
       * Show user prompt with suggestion to add our app to home screen
       */
      deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(result){

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
    return new Promise(function(resolve, reject) { return reject({message: errorMessage}) });

}
function closeCreatePostModal() {
    createPostArea.style.transform = 'translateY(100vh)';

}
function removeCards() {
    while(sharedMomentsArea.hasChildNodes()) {
        sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
    }

}
function createCard(item) {
    const cardWrapper = document.createElement('div');

    cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
    const cardTitle = document.createElement('div');
    cardTitle.className = 'mdl-card__title';
    cardTitle.style.backgroundImage = 'url("' + item.image + '")';
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
    fetch('https://us-central1-my-pwagram.cloudfunctions.net/storePostData', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(post),
    }).then(function (resp) {
        console.log('Post saved: ', resp);
    }).catch(function (err) {
        console.log('Failed to save post: ', err);
    });
}

function syncPost(post) {
    post.syncId = new Date().toISOString();
    post.image = 'https://citydiscovery2.imgix.net/new_york.jpg?w=2100&h=1100&bri=-12&q=30&auto=format&crop=entropy&fit=crop';
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(function (sw) {
            writeData(SYNC_POSTS, post).then(function () {
                return sw.sync.register('store-new-post');
            }).then(function (result) {
                snackBar.MaterialSnackbar.showSnackbar({message: 'Your post saved for sync!'})
            }).catch(function (err) {
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
    ].reduce(function (result, element){
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
    .then(function(resp){
        return resp.json();
    })
    .then(results => Object.keys(results).map(keyName => results[keyName]))
    .then(function(data) {
        console.log('response: ', data);
        removeCards();
        [].forEach.call(data, (item) => createCard(item));

    })
    .catch(errorHandler);

if ('indexedDB' in window) {
    readAll('posts').then(function(data) {
        if (!networkDataReceived) {
            console.log('FROM DB', data);
            [].forEach.call(data, (item) => createCard(item));
        }
    })
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


