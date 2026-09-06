import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { defaultFirebaseConfig } from './firebaseConfig';

const configSource = defaultFirebaseConfig;

const firebaseConfig = {
  apiKey: configSource.apiKey,
  authDomain: configSource.authDomain,
  projectId: configSource.projectId,
  storageBucket: configSource.storageBucket,
  messagingSenderId: configSource.messagingSenderId,
  appId: configSource.appId,
  measurementId: configSource.measurementId || '',
};

// Initialize Firebase App safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore with configured database ID and long-polling connection
const databaseId = configSource.firestoreDatabaseId && configSource.firestoreDatabaseId !== '(default)'
  ? configSource.firestoreDatabaseId
  : undefined;

export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      databaseId
    );
  } catch {
    try {
      return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    } catch (fallbackErr) {
      console.warn('Firestore fallback initialization:', fallbackErr);
      return getFirestore(app);
    }
  }
})();
