/* =========================================================
   LIKES
   Firebase mode (FIREBASE_READY): requires sign-in, matching the app.
   One like per ACCOUNT — `likedBy` (array of uid) and `likes` (count)
   are written together in a single update, exactly matching the
   Firestore rule that only allows a +1/uid-add or -1/uid-remove pair,
   never one field without the other.
   Local-only mode (no Firebase configured): no accounts exist at all,
   so likes fall back to one-per-browser via localStorage, same as
   before — there's nothing to "sign in" to in that mode.
   ========================================================= */
const LIKED_POSTS_KEY = 'footy-inform-liked-posts'; // local-only mode fallback only
function getLocalLikedPostIds(){
  try{
    const raw = localStorage.getItem(LIKED_POSTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveLocalLikedPostIds(ids){
  try{ localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(ids)); }catch(e){}
}

function isPostLikedByViewer(post){
  if(FIREBASE_READY){
    const user = currentUser();
    if(!user) return false;
    return Array.isArray(post.likedBy) && post.likedBy.includes(user.uid);
  }
  return getLocalLikedPostIds().includes(post.id);
}

function doToggleLike(post){
  const alreadyLiked = isPostLikedByViewer(post);

  if(FIREBASE_READY){
    const user = currentUser();
    if(!user) return; // shouldn't happen — caller already gated via withSignIn
    const delta = alreadyLiked ? -1 : 1;
    const newLikedBy = alreadyLiked
      ? (post.likedBy || []).filter(uid => uid !== user.uid)
      : [...(post.likedBy || []), user.uid];
    // Reflect immediately in local state so the UI updates without waiting
    // on the round-trip, then persist both fields together.
    post.likes = Math.max(0, (post.likes || 0) + delta);
    post.likedBy = newLikedBy;
    db.collection('posts').doc(post.id).update({
      likes: firebase.firestore.FieldValue.increment(delta),
      likedBy: alreadyLiked
        ? firebase.firestore.FieldValue.arrayRemove(user.uid)
        : firebase.firestore.FieldValue.arrayUnion(user.uid)
    }).catch(err=>{
      console.warn('Could not update like:', err);
      // roll back the optimistic local change on failure
      post.likes = Math.max(0, post.likes - delta);
      post.likedBy = alreadyLiked ? [...post.likedBy, user.uid] : post.likedBy.filter(uid=>uid!==user.uid);
      syncLikeButtonsFor(post);
    });
  } else {
    const delta = alreadyLiked ? -1 : 1;
    post.likes = Math.max(0, (post.likes || 0) + delta);
    const likedIds = getLocalLikedPostIds();
    saveLocalLikedPostIds(alreadyLiked ? likedIds.filter(x=>x!==post.id) : [...likedIds, post.id]);
    saveLocalPosts();
  }

  syncLikeButtonsFor(post);
}

// Updates every like button currently on screen for this post (the
// homepage card AND the open article view, if either is showing it) so
// a like made in one place is reflected in the other immediately.
function syncLikeButtonsFor(post){
  const liked = isPostLikedByViewer(post);
  const count = post.likes || 0;

  const cardBtn = document.querySelector(`.card-h-like[data-id="${post.id}"]`);
  if(cardBtn){
    cardBtn.classList.toggle('liked', liked);
    cardBtn.querySelector('.heart').textContent = liked ? '♥' : '♡';
    cardBtn.querySelector('.like-num').textContent = count;
  }
  const articleBtn = document.getElementById('likeBtn');
  if(articleBtn && articleBtn.dataset.id === post.id){
    articleBtn.classList.toggle('liked', liked);
    articleBtn.querySelector('.heart').textContent = liked ? '♥' : '♡';
    articleBtn.querySelector('#likeCount').textContent = count;
  }
}

// Article-view like button.
function toggleLike(post){
  withSignIn(()=> doToggleLike(post));
}

// Homepage-card like button. Stops the click from also opening the article.
function handleCardLike(e, postId){
  e.preventDefault();
  e.stopPropagation();
  const post = posts.find(p=>p.id===postId);
  if(!post) return;
  withSignIn(()=> doToggleLike(post));
}
