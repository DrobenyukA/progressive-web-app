const DB_VERSION = '1';
const DB_NAME = 'pwaGramDB';
const POSTS_TABLE = 'posts';
const SYNC_POSTS = 'sync-posts';

const dbPromise = idb.open(DB_NAME, DB_VERSION, function (db) {
    createStoreIfNotExists(POSTS_TABLE, {keyPath: 'id'}, db);
    createStoreIfNotExists(SYNC_POSTS, {keyPath: 'syncId'}, db);
});

function createStoreIfNotExists(name, options, db) {
    if (!db.objectStoreNames.contains(name)) {
        db.createObjectStore(name, options);
    }
}

function writeData(tableName, data) {
    return dbPromise.then(function(db) {
        const transaction = db.transaction(tableName, 'readwrite');
        const store = transaction.objectStore(tableName);
        store.put(data);
        return transaction.complete;
    })
}

function readAll(tableName) {
    return dbPromise.then(function(db) {
        const transaction = db.transaction(tableName, 'readonly');
        const store = transaction.objectStore(tableName);
        return store.getAll();
    });
}

function removeAllData(tableName) {
    return dbPromise.then(function(db) {
        const transaction = db.transaction(tableName, 'readwrite');
        const store = transaction.objectStore(tableName);
        store.clear();
        return transaction.complete;
    });
}

function removeItem(tableName, id) {
    return dbPromise.then(function(db) {
        const transaction = db.transaction(tableName, 'readwrite');
        const store = transaction.objectStore(tableName);
        store.delete(id);
        return transaction.complete;
    });
}