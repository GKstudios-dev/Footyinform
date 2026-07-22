/* =========================================================
   COMMENTS
   Requires sign-in to post, matching /posts/{id}/comments rules:
   userId/userEmail must match the signed-in account, text 1–1000
   chars, createdAt must be the server timestamp. Only the comment's
   own author or the admin can delete it; nobody can edit one after
   posting. Local-only mode (no Firebase) doesn't support comments —
   there's no shared place to store them, so the compose box explains
   that instead of pretending to work.
   ========================================================= */
let commentsUnsubscribe = null;

function stopCommentsListener(){
  if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; }
}

function startCommentsListener(postId){
  stopCommentsListener();
  if(!FIREBASE_READY) return;
  commentsUnsubscribe = db.collection('posts').doc(postId).collection('comments')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snapshot=>{
        const comments = snapshot.docs.map(d=>({ id:d.id, ...d.data() }));
        renderCommentList(comments);
      },
      err=> console.warn('Could not load comments:', err)
    );
}

function renderCommentList(comments){
  const list = document.getElementById('commentList');
  const countEl = document.getElementById('commentCount');
  if(!list) return;
  countEl.textContent = comments.length;

  if(!comments.length){
    list.innerHTML = `<div class="comment-empty">No comments yet — be the first.</div>`;
    return;
  }

  const user = currentUser();
  list.innerHTML = comments.map(c=>{
    const canDelete = user && (user.uid === c.userId || isAdmin());
    return `
      <div class="comment-item" data-id="${c.id}">
        <div class="comment-head">
          <span class="comment-author">${escapeHtml(c.userEmail || 'Anonymous')}</span>
          <span class="comment-time">${commentTimeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text || '')}</div>
        ${canDelete ? `<button class="comment-del" data-id="${c.id}">Delete</button>` : ''}
      </div>`;
  }).join('');

  list.querySelectorAll('.comment-del').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteComment(currentOpenArticleId, btn.dataset.id));
  });
}

// createdAt is a Firestore server timestamp — null for an instant right
// after the optimistic local render, before the server has responded.
function commentTimeAgo(createdAt){
  if(!createdAt || typeof createdAt.toDate !== 'function') return 'Just now';
  return timeAgo(createdAt.toDate());
}

function renderCommentComposeArea(){
  const box = document.getElementById('commentComposeArea');
  if(!box) return;
  if(!FIREBASE_READY){
    box.innerHTML = `<div class="comment-signin-hint">Comments need the shared backend to be configured.</div>`;
    return;
  }
  if(!isSignedIn()){
    box.innerHTML = `
      <div class="comment-signin-hint">
        <span>Sign in to leave a comment.</span>
        <button class="write-btn" id="commentSignInBtn">Sign In</button>
      </div>`;
    document.getElementById('commentSignInBtn').addEventListener('click', ()=> openAuthModal('signin'));
    return;
  }
  box.innerHTML = `
    <div class="comment-compose">
      <textarea id="commentInput" maxlength="1000" placeholder="Share your thoughts..."></textarea>
      <div class="compose-foot">
        <span class="char-hint" id="commentCharHint">0 / 1000</span>
        <button class="publish-btn" id="commentSubmitBtn" style="padding:8px 16px;font-size:13px;">Post comment</button>
      </div>
    </div>`;
  const input = document.getElementById('commentInput');
  input.addEventListener('input', ()=>{
    document.getElementById('commentCharHint').textContent = `${input.value.length} / 1000`;
  });
  document.getElementById('commentSubmitBtn').addEventListener('click', submitComment);
}

function submitComment(){
  const input = document.getElementById('commentInput');
  const text = input.value.trim();
  if(!text || !currentOpenArticleId) return;
  const user = currentUser();
  if(!user) return;

  const postRef = db.collection('posts').doc(currentOpenArticleId);
  const commentRef = postRef.collection('comments').doc();
  const batch = db.batch();
  batch.set(commentRef, {
    userId: user.uid,
    userEmail: user.email || 'Anonymous',
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  batch.update(postRef, {
    commentCount: firebase.firestore.FieldValue.increment(1)
  });

  const submitBtn = document.getElementById('commentSubmitBtn');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Posting…'; }

  batch.commit()
    .then(()=>{
      input.value = '';
      document.getElementById('commentCharHint').textContent = '0 / 1000';
    })
    .catch(err=>{
      console.warn('Could not post comment:', err);
      alert('Could not post your comment — try again.');
    })
    .finally(()=>{
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Post comment'; }
    });
}

function deleteComment(postId, commentId){
  if(!postId) return;
  if(!confirm('Delete this comment?')) return;
  db.collection('posts').doc(postId).collection('comments').doc(commentId).delete()
    .catch(err=>{ console.warn('Could not delete comment:', err); alert('Could not delete this comment.'); });
}

// Called when auth state changes while an article is open, so the
// compose box and delete buttons reflect the new sign-in state right away.
function refreshArticleAuthState(){
  renderCommentComposeArea();
}
