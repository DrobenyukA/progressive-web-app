const shareImageButton = document.querySelector('#share-image-button');
const createPostArea = document.querySelector('#create-post');
const closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
const sharedMomentsArea = document.querySelector('#shared-moments');

let networkDataReceived = false;

function errorHandler(error){
    console.log('[Page] ERROR:', error);
}

function openCreatePostModal() {
  createPostArea.style.display = 'block';
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
  createPostArea.style.display = 'none';
}

function removeCards() {
    while(sharedMomentsArea.hasChildNodes()) {
        sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
    }
}

function createCard(name) {
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';

    const cardTitle = document.createElement('div');
    cardTitle.className = 'mdl-card__title';
    cardTitle.style.backgroundImage = 'url("/src/images/sf-boat.jpg")';
    cardTitle.style.backgroundSize = 'cover';
    cardTitle.style.height = '180px';
    cardWrapper.appendChild(cardTitle);

    const cardTitleTextElement = document.createElement('h2');
    cardTitleTextElement.className = 'mdl-card__title-text';
    cardTitleTextElement.textContent = 'San Francisco Trip';
    cardTitle.appendChild(cardTitleTextElement);

    const cardSupportingText = document.createElement('div');
    cardSupportingText.className = 'mdl-card__supporting-text';
    cardSupportingText.textContent = name || 'In San Francisco';
    cardSupportingText.style.textAlign = 'center';
    cardWrapper.appendChild(cardSupportingText);
    componentHandler.upgradeElement(cardWrapper);
    sharedMomentsArea.appendChild(cardWrapper);
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

fetch('https://httpbin.org/get')
    .then(function(resp){
        return resp.json();
    })
    .then(function(data) {
        networkDataReceived = true;
        console.log('From web', data);
        removeCards();
        createCard('From web');
    })
    .catch(errorHandler);

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


