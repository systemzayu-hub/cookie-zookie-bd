// Identificadores públicos do app Firebase. Chaves privadas nunca entram no bundle.
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAPk3By_sNlHxsHsFHwofzfts2MhSNwgPs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sitezayuo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sitezayuo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sitezayuo.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '501011738641',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:501011738641:web:32cbe4b6a353cd964641b0',
};

export const FIREBASE_APP_CHECK_SITE_KEY = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || ''
