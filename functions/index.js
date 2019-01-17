const fs = require('fs');
const os = require("os");
const path = require('path');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({
    origin: true
});
const serviceAccount = require('./sdkConfig.json');
const webPush = require('web-push');
const config = require('./secret.json');
const configureGCS = require('@google-cloud/storage');
const generateId = require('uuid-v4');
const Busboy = require('busboy');
const googleCloudConf = {
    projectId: 'my-pwagram',
    keyFilename: 'sdkConfig.json',
};
const gcs = configureGCS(googleCloudConf);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://my-pwagram.firebaseio.com"
});

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.storePostData = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        const busboy = new Busboy({ headers: req.headers });
        const pictureId = generateId();
        // These objects will store the values (file + fields) extracted from busboy
        const fields = {};
        let upload;

        // This callback will be invoked for each file uploaded
        busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
            console.log(`File [${fieldname}] filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`
);
            const filepath = path.join(os.tmpdir(), filename);
            upload = { file: filepath, type: mimetype };
            file.pipe(fs.createWriteStream(filepath));
        });

        // This will invoked on every field detected
        busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
            fields[fieldname] = val;
        });

        // This callback will be invoked after all uploaded files are saved.
        busboy.on("finish", () => {
            const bucket = gcs.bucket("my-pwagram.appspot.com");
            const bucketConf = {
                uploadType: "media",
                metadata: {
                  metadata: {
                    contentType: upload.type,
                    firebaseStorageDownloadTokens: pictureId
                  }
                }
              }
            bucket.upload(upload.file, bucketConf, (err, uploadedFile) => {
                if(err) {
                    console.log(err);
                } else {
                    admin.database().ref('posts').push({
                        syncId: fields.syncId,
                        title: fields.title,
                        location: fields.location,
                        picture: 'https://firebasestorage.googleapis.com/v0/b/' + bucket.name + '/o/' + encodeURIComponent(uploadedFile.name) + '?alt=media&token=' + pictureId,
                    })
                    .then(() => {
                        webPush.setVapidDetails(
                            'mailto:andriy.drobenyuk@gmail.com',
                            config.public, // config.public, // TODO: replace these values onto hidden constants
                            config.private // config.private // TODO: replace these values onto hidden constants
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
                        return res.status(201).json({
                            message: 'success',
                            id: fields.syncId
                        })
                    }).catch((err) => res.status(500).json({
                        error: err
                    }));
                }
            })
        });

        // The raw bytes of the upload will be in request.rawBody.  Send it to busboy, and get
        // a callback when it's finished.
        busboy.end(req.rawBody);
    })
});