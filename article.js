/* =========================================================
   READ TRACKING — every time an article is opened, we stamp
   "readAt" with the current time and save it to Firestore
   (or local storage if Firebase isn't configured). That
   timestamp is what powers the "Read 3 minutes ago" / "Read
   just now" line on both the homepage card and the article
   itself, using the same relative-time logic as the post date.
   A live timer keeps the on-screen text ticking upward while
   the article stays open, without needing a page refresh.
   ========================================================= */
let currentOpenArticleId = null;
let readStatusTimer = null;

function recordRead(post){
  const now = new Date().toISOString();
  post.readAt = now; // reflect immediately in local state
  if(FIREBASE_READY){
    db.collection('posts').doc(post.id).update({ readAt: now })
      .catch(err=> console.warn('Could not save read time:', err));
  } else {
    saveLocalPosts();
  }
}

function refreshReadStatusUI(id){
  const p = posts.find(x=>x.id===id);
  if(!p) return;
  const statusEl = document.getElementById('readStatus');
  if(statusEl) statusEl.textContent = p.readAt ? `Read ${timeAgo(p.readAt)}` : 'Read just now';
}

function stopReadStatusTimer(){
  if(readStatusTimer){ clearInterval(readStatusTimer); readStatusTimer = null; }
}

/* Picks "plenty" of related posts for the bottom-of-article widget —
   same category first (most recent), topped up with other recent
   posts if the category doesn't have enough on its own. Shown as a
   single stacked list (not a grid) so it reads the same on phone and
   desktop, closer to how NYT/Yahoo-style "more stories" lists work. */
function relatedPostsFor(p, limit = 8){
  const sameCategory = posts
    .filter(x => x.id !== p.id && x.category === p.category)
    .sort((a,b)=> toJSDate(b.date) - toJSDate(a.date));
  const picked = sameCategory.slice(0, limit);
  if(picked.length < limit){
    const usedIds = new Set([p.id, ...picked.map(x=>x.id)]);
    const filler = posts
      .filter(x => !usedIds.has(x.id))
      .sort((a,b)=> toJSDate(b.date) - toJSDate(a.date))
      .slice(0, limit - picked.length);
    picked.push(...filler);
  }
  return picked;
}

function relatedCardHtml(p){
  return `
    <a class="related-card" href="#" data-id="${p.id}">
      <img src="${p.image}" alt="${escapeHtml(p.imageAlt||'')}" loading="lazy">
      <span class="tag ${p.category}">${CATEGORY_LABELS[p.category]}</span>
      <h4>${escapeHtml(p.title)}</h4>
    </a>`;
}

function attachRelatedCardHandlers(container){
  container.querySelectorAll('.related-card').forEach(card=>{
    card.addEventListener('click', (e)=>{
      e.preventDefault();
      openArticle(card.dataset.id);
    });
  });
}

function openArticle(id){
  const p = posts.find(x=>x.id===id);
  if(!p) return;
  const bodyHtml = bodyToHtml(p.body);
  const isLiked = isPostLikedByViewer(p);
  const likeCount = p.likes || 0;
  const related = relatedPostsFor(p);

  currentOpenArticleId = id;
  recordRead(p);

  document.getElementById('articleContent').innerHTML = `
    <div class="article-meta">
      <span class="tag ${p.category}">${CATEGORY_LABELS[p.category]}</span>
    </div>
    <h1>${escapeHtml(p.title)}</h1>
    ${p.subtitle ? `<p class="article-subtitle">${escapeHtml(p.subtitle)}</p>` : ''}
    <img class="article-hero" src="${p.image}" alt="${escapeHtml(p.imageAlt||'')}">
    ${p.imageAlt ? `<div class="img-caption">${escapeHtml(p.imageAlt)}</div>` : ''}
    <div class="byline">By <b>${escapeHtml(p.author || 'Footy Post Staff')}</b> &middot; ${fmtDate(p.date)}</div>
    <div class="read-status" id="readStatus">Read just now</div>
    <div class="article-body">${bodyHtml}</div>
    <div class="like-row">
      <button class="like-btn ${isLiked ? 'liked' : ''}" id="likeBtn" data-id="${id}">
        <span class="heart">${isLiked ? '♥' : '♡'}</span>
        <span id="likeCount">${likeCount}</span> ${likeCount===1?'Like':'Likes'}
      </button>
    </div>
    ${isAdmin() ? `
      <button class="publish-btn" id="editPostBtn" style="margin-top:24px;">Edit this post</button>
      <button class="cancel-btn" id="deletePostBtn" style="margin-top:24px;margin-left:10px;">Delete this post</button>
    ` : ''}
    <div class="comments-section">
      <div class="comments-heading">
        <div class="section-label">Comments</div>
        <span class="count">(<span id="commentCount">0</span>)</span>
      </div>
      <div id="commentComposeArea"></div>
      <div class="comment-list" id="commentList"></div>
    </div>
    ${related.length ? `
      <div class="related-section">
        <div class="section-label">Read Also</div>
        <div class="related-grid" id="relatedGrid">
          ${related.map(relatedCardHtml).join('')}
        </div>
      </div>
    ` : ''}
  `;
  const editBtn = document.getElementById('editPostBtn');
  if(editBtn) editBtn.addEventListener('click', ()=>{ loadPostIntoWriter(p); showWriter(); });
  const delBtn = document.getElementById('deletePostBtn');
  if(delBtn) delBtn.addEventListener('click', ()=> deletePost(p.id));
  const likeBtn = document.getElementById('likeBtn');
  if(likeBtn) likeBtn.addEventListener('click', ()=> toggleLike(p));
  const relatedGrid = document.getElementById('relatedGrid');
  if(relatedGrid) attachRelatedCardHandlers(relatedGrid);

  renderCommentComposeArea();
  startCommentsListener(id);

  stopReadStatusTimer();
  readStatusTimer = setInterval(()=> refreshReadStatusUI(id), 15000);

  // reflect the fresh "Read just now" on the homepage card too, next
  // time the feed is drawn (e.g. when the user hits Back)
  renderFeed();

  showArticle();
}

// Body can be either a legacy array (## heading / paragraph strings from
// the original sample posts) or a plain HTML string (from the rich editor).
function bodyToHtml(body){
  if(!body) return '';
  if(Array.isArray(body)){
    return body.map(block=> block.startsWith('## ') ? `<h2>${escapeHtml(block.slice(3))}</h2>` : `<p>${escapeHtml(block)}</p>`).join('');
  }
  return body;
}
