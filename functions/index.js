const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
const serviceAccount = require("./config.json");

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
                const data = {message: 'success', id: req.body.syncId};
                return res.status(201).json(data);
            }).catch((err) => res.status(500).json({error: err}));
    })
});
