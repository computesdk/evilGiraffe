import { openDB, addRecord, getAllRecords } from './db.js';

// Initialize the database
await openDB();

// Add a record
await addRecord({
    message: "Hello",
    response: "Hi there!",
    model: "llama2",
    timestamp: new Date().toISOString()
});

// Get all records
const records = await getAllRecords();// IndexedDB configuration
const DB_NAME = 'EvilGiraffeDB';
const DB_VERSION = 1;
const STORE_NAME = 'chatHistory';

// Database instance
let db;

// Open/Create IndexedDB
export async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            reject(new Error('Database error: ' + event.target.errorCode));
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });

                // Create indexes
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                objectStore.createIndex('model', 'model', { unique: false });
            }
        };
    });
}

// Add a new chat record
export async function addRecord(record) {
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(record);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        throw error;
    }
}

// Get all chat records (ordered by timestamp)
export async function getAllRecords() {
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const request = index.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        throw error;
    }
}

// Get records by model
export async function getRecordsByModel(model) {
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('model');
        const request = index.getAll(IDBKeyRange.only(model));
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        throw error;
    }
}

// Delete a record by id
export async function deleteRecord(id) {
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        throw error;
    }
}

// Clear all records
export async function clearAllRecords() {
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        throw error;
    }
}

// Export all functions
export {
    openDB,
    addRecord,
    getAllRecords,
    getRecordsByModel,
    deleteRecord,
    clearAllRecords
};