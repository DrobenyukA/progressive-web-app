const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const serviceAccount = require('./sdkConfig.json');
const webPush = require('web-push');
const config = require('./secret.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://my-pwagram.firebaseio.com"
});

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.storePostData = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        return admin.database().ref('posts').push(req.body)
            .then(() => {
                webPush.setVapidDetails(
                    'mailto:andriy.drobenyuk@gmail.com',
                    'BPwh4ZAP3RaLN1bpxMP9s9k97y6UgiSCf56sxmNK-R4CC_jJI0SUi04e96Af1U4edoyGIlWMmTm9b9tG2VoMmd0', // config.public, // TODO: replace these values onto hidden constants
                    'F_DEUlAcO9g98rpdKh5oqvzTeE8mHEUxy4i1AVyMumw' // config.private // TODO: replace these values onto hidden constants
                );
                return admin.database().ref('subscriptions').once('value');
            })
            .then((subscriptions) => {
                subscriptions.forEach((item) => {
                    const pushConfig = {
                        endpoint: item.val().endpoint,
                        keys: {
                            p256dh: item.val().keys.p256dh,
                            auth: item.val().keys.auth,
                        }
                    };
                    webPush.sendNotification(
                        pushConfig,
                        JSON.stringify({
                            title: 'New post',
                            content: 'Some post content',
                            openUrl: 'http://localhost:3030/help'
                        })
                    ).catch((err) => console.log(err));
                })
                return res.status(201).json({message: 'success', id: req.body.syncId})
            }).catch((err) => res.status(500).json({error: err}));
    })
});
