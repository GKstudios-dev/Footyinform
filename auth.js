/* =========================================================
   ADMIN GATE — regular readers never see "Admin," "+ New Post,"
   or any delete controls at all. To reach admin mode yourself,
   open the site with #admin on the end of the URL, e.g.:
     https://gkstudioshq.github.io/FootyInform/#admin
   Bookmark that link for yourself — that's your private way in.
   Once you sign in there, the site remembers you (Firebase keeps
   you signed in), so you'll see the admin controls on later visits
   automatically, even without the #admin link. Readers who don't
   know that link only ever see the plain reading view.
   In local-only mode (no Firebase configured yet) there's no real
   risk either way, so the controls just stay visible with no login.
   ========================================================= */
const openWriterBtn = document.getElementById('openWriter');
const sidebarWriteBtn = document.getElementById('sidebarWrite');
const openDashboardBtn = document.getElementById('openDashboard');
const adminBtn = document.getElementById('adminBtn');
const adminPanel = document.getElementById('adminPanel');

function isAdminUrl(){
  return location.hash.replace('#','').split('&').includes('admin');
}
function setWriteControlsVisible(visible){
  openWriterBtn.hidden = !visible;
  sidebarWriteBtn.hidden = !visible;
  openDashboardBtn.hidden = !visible;
}

// Any signed-in Firebase user (reader OR admin) — used to gate
// likes/comments, exactly like AuthService().currentUser in the app.
function currentUser(){
  if(!FIREBASE_READY) return null;
  try{ return firebase.auth().currentUser; }catch(e){ return null; }
}
function isSignedIn(){ return !!currentUser(); }

// Admin specifically — the one email your Firestore rules give full
// write/delete access to.
function isAdmin(){
  if(!FIREBASE_READY) return true; // local-only mode: no backend to protect
  const user = currentUser();
  return !!(user && user.email === ADMIN_EMAIL);
}
function setAdminOnlyUiVisible(visible){
  adminBtn.hidden = !visible;
  document.getElementById('modeBadge').hidden = !visible;
  document.getElementById('footerAdminNote').hidden = !visible;
}

if(FIREBASE_READY){
  setWriteControlsVisible(false);
  setAdminOnlyUiVisible(isAdminUrl());
  try{
    firebase.auth().onAuthStateChanged(user=>{
      setWriteControlsVisible(isAdmin());
      setAdminOnlyUiVisible(isAdmin() || isAdminUrl());
      adminBtn.textContent = isAdmin() ? 'Sign out' : 'Admin';
      renderSidebarAccount();
      // an article may be open with stale like/comment permission state
      if(!document.getElementById('articleView').hidden && currentOpenArticleId){
        refreshArticleAuthState();
      }
      // run whatever the reader was trying to do before we asked them to sign in
      if(user && pendingSignedInAction){
        const action = pendingSignedInAction;
        pendingSignedInAction = null;
        action();
      }
    });
  }catch(e){
    // If Firebase Auth fails to start (blocked by a browser extension, network
    // issue, etc.) admin sign-in just won't work — but this must not stop the
    // rest of the page (in particular, loading articles further down) from running.
    console.warn('Firebase Auth failed to start — sign-in disabled, articles will still load:', e);
  }
} else {
  setWriteControlsVisible(true);
  setAdminOnlyUiVisible(false); // local-only mode: nothing to log into, badge/note not relevant to readers either
}

adminBtn.addEventListener('click', ()=>{
  if(!FIREBASE_READY) return;
  if(isAdmin()){
    firebase.auth().signOut();
    return;
  }
  document.getElementById('adminError').textContent = '';
  adminPanel.hidden = false;
});
document.getElementById('adminCancel').addEventListener('click', ()=> adminPanel.hidden = true);
document.getElementById('adminSubmit').addEventListener('click', ()=>{
  const email = document.getElementById('admin_email').value.trim();
  const pass = document.getElementById('admin_pass').value;
  const errBox = document.getElementById('adminError');
  errBox.textContent = '';
  firebase.auth().signInWithEmailAndPassword(email, pass)
    .then(()=>{
      adminPanel.hidden = true;
      document.getElementById('admin_pass').value = '';
    })
    .catch(err=>{ errBox.textContent = 'Sign-in failed — check the email and password.'; });
});

/* =========================================================
   READER SIGN-IN / SIGN-UP — matches the app's drawer "Sign In —
   To like and comment on articles" tile. Same underlying Firebase
   email/password auth as the admin panel above; the only difference
   is this modal also lets a brand-new reader CREATE an account
   (createUserWithEmailAndPassword), and it's reachable from the
   sidebar instead of being admin-only.
   ========================================================= */
let authModalMode = 'signin'; // 'signin' | 'signup'
let pendingSignedInAction = null; // re-run automatically once sign-in succeeds

function renderSidebarAccount(){
  const box = document.getElementById('sidebarAccount');
  if(!box) return;
  if(!FIREBASE_READY){
    box.innerHTML = '';
    return;
  }
  const user = currentUser();
  if(user){
    box.innerHTML = `
      <button class="sidebar-account" id="sidebarAccountBtn">
        <svg class="acct-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/></svg>
        <span class="acct-text">
          <span class="acct-main">${escapeHtml(user.email || 'Signed in')}</span>
          <span class="acct-sub">Tap to sign out</span>
        </span>
      </button>`;
    document.getElementById('sidebarAccountBtn').addEventListener('click', ()=>{
      firebase.auth().signOut();
      closeSidebar();
    });
  } else {
    box.innerHTML = `
      <button class="sidebar-account" id="sidebarAccountBtn">
        <svg class="acct-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
        <span class="acct-text">
          <span class="acct-main">Sign In</span>
          <span class="acct-sub">To like and comment on articles</span>
        </span>
      </button>`;
    document.getElementById('sidebarAccountBtn').addEventListener('click', ()=>{
      closeSidebar();
      openAuthModal();
    });
  }
}

function openAuthModal(mode){
  if(!FIREBASE_READY){
    alert('Sign-in needs the shared backend to be configured — see the note in js/firebase-config.js.');
    return;
  }
  authModalMode = mode || 'signin';
  document.getElementById('authError').textContent = '';
  document.getElementById('auth_email').value = '';
  document.getElementById('auth_pass').value = '';
  updateAuthModalMode();
  document.getElementById('authOverlay').style.display = 'block';
  document.getElementById('authModal').hidden = false;
  document.getElementById('auth_email').focus();
}
function closeAuthModal(){
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('authModal').hidden = true;
  pendingSignedInAction = null;
}
function updateAuthModalMode(){
  const signUp = authModalMode === 'signup';
  document.getElementById('authTitle').textContent = signUp ? 'Create your account' : 'Sign in';
  document.getElementById('authSub').textContent = signUp
    ? 'Takes a few seconds — lets you like and comment on articles.'
    : 'Sign in to like and comment on articles.';
  document.getElementById('authSubmit').textContent = signUp ? 'Create account' : 'Sign in';
  document.getElementById('authSwitchText').textContent = signUp ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('authSwitchBtn').textContent = signUp ? 'Sign in' : 'Create one';
}

document.getElementById('authOverlay').addEventListener('click', closeAuthModal);
document.getElementById('authCancel').addEventListener('click', closeAuthModal);
document.getElementById('authSwitchBtn').addEventListener('click', ()=>{
  authModalMode = authModalMode === 'signup' ? 'signin' : 'signup';
  document.getElementById('authError').textContent = '';
  updateAuthModalMode();
});
document.getElementById('authSubmit').addEventListener('click', ()=>{
  const email = document.getElementById('auth_email').value.trim();
  const pass = document.getElementById('auth_pass').value;
  const errBox = document.getElementById('authError');
  errBox.textContent = '';
  if(!email || !pass){ errBox.textContent = 'Enter an email and password.'; return; }

  const method = authModalMode === 'signup'
    ? firebase.auth().createUserWithEmailAndPassword(email, pass)
    : firebase.auth().signInWithEmailAndPassword(email, pass);

  method
    .then(()=>{ closeAuthModal(); })
    .catch(err=>{
      if(err.code === 'auth/email-already-in-use'){
        errBox.textContent = 'That email already has an account — try signing in instead.';
      } else if(err.code === 'auth/weak-password'){
        errBox.textContent = 'Password should be at least 6 characters.';
      } else if(err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'){
        errBox.textContent = 'Incorrect email or password.';
      } else {
        errBox.textContent = 'Something went wrong — try again.';
      }
    });
});

// Used by likes.js / comments.js: run `action` if the reader is already
// signed in; otherwise pop the sign-in modal and remember to run `action`
// automatically the moment sign-in succeeds.
function withSignIn(action){
  if(isSignedIn()){ action(); return; }
  pendingSignedInAction = action;
  openAuthModal('signin');
}
