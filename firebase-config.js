/* =========================================================
   SHARED BACKEND SETUP (Firebase — free tier is plenty for a blog)
   =========================================================
   1. Go to https://console.firebase.google.com → Add project (free).
   2. In the project, click "Firestore Database" → Create database →
      start in TEST MODE (fine while you're building; lock it down
      later with your security rules).
   3. Click the gear icon → Project settings → scroll to "Your apps" →
      click the </> (web) icon → register the app → it shows you a
      config object. Copy those 6 values into FIREBASE_CONFIG below.
   4. Save this file, push to GitHub, done — every visitor now sees
      the same posts, live, no page reload needed.
   Leave the placeholders as-is and the site just runs in local-only
   mode (posts saved to your browser only) — nothing breaks.
   ========================================================= */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC3voAMmdRAKjQNqPodo48bhpS-Hbk665U",
  authDomain: "footy-inform.firebaseapp.com",
  projectId: "footy-inform",
  storageBucket: "footy-inform.firebasestorage.app",
  messagingSenderId: "1012360360408",
  appId: "1:1012360360408:web:05c6fce72031ea870782ad"
};
const FIREBASE_READY = !!(FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('PASTE_'));
let db = null;
if(FIREBASE_READY){
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  }catch(e){ console.warn('Firebase failed to start, falling back to local-only mode:', e); }
}

// The one email that gets admin (write/delete-anything) powers — must
// match request.auth.token.email == '...' in your Firestore rules exactly.
const ADMIN_EMAIL = 'keketsyorgabriel@gmail.com';
