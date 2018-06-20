var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');

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

function closeCreatePostModal() {
  createPostArea.style.display = 'none';
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);
