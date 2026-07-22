let carouselTimer = null;
function stopCarousel(){
  if(carouselTimer){ clearInterval(carouselTimer); carouselTimer = null; }
}

function cardHtml(p){
  const readBadge = p.readAt ? `<div class="read-badge">Read ${timeAgo(p.readAt)}</div>` : '<span></span>';
  const isLiked = isPostLikedByViewer(p);
  const likeCount = p.likes || 0;
  const commentCount = p.commentCount || 0;
  return `
    <a class="card-h" href="#" data-id="${p.id}">
      <div class="card-h-flow">
        <img class="card-h-img" src="${p.image}" alt="${escapeHtml(p.imageAlt||'')}" loading="lazy">
        <div class="card-h-meta">
          <span class="tag ${p.category}">${CATEGORY_LABELS[p.category]}</span>
          <span class="dot">&middot;</span>
          <span>${fmtDate(p.date)}</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <span class="snippet-h"> — ${escapeHtml(p.snippet)}</span>
      </div>
      <div class="card-h-foot">
        ${readBadge}
        <div class="card-h-actions">
          <span class="card-h-comment"><span class="bubble">💬</span>${commentCount}</span>
          <button type="button" class="card-h-like ${isLiked?'liked':''}" data-id="${p.id}" aria-label="${isLiked?'Unlike':'Like'} this post" onclick="handleCardLike(event,'${p.id}')">
            <span class="heart">${isLiked?'♥':'♡'}</span><span class="like-num">${likeCount}</span>
          </button>
        </div>
      </div>
    </a>`;
}

function attachCardHandlers(container){
  container.querySelectorAll('.card-h').forEach(card=>{
    card.addEventListener('click', (e)=>{
      if(e.target.closest('.card-h-like')) return; // like button handles its own click
      e.preventDefault();
      openArticle(card.dataset.id);
    });
  });
}

function buildCarouselHtml(list){
  if(!list.length) return '';
  return `
    <div class="trending-carousel">
      <div class="trending-track">
        ${list.map((p,i)=>`
          <a href="#" class="trending-slide ${i===0?'active':''}" data-id="${p.id}" style="background-image:url('${p.image}')">
            <div class="trending-slide-overlay">
              <span class="badge">TRENDING</span>
              <h3>${escapeHtml(p.title)}</h3>
            </div>
          </a>`).join('')}
      </div>
      ${list.length>1 ? `<div class="trending-dots">
        ${list.map((_,i)=>`<span class="trending-dot ${i===0?'active':''}"></span>`).join('')}
      </div>` : ''}
    </div>`;
}

function startCarousel(count){
  if(count<=1) return;
  let idx = 0;
  carouselTimer = setInterval(()=>{
    const slides = document.querySelectorAll('.trending-slide');
    const dots = document.querySelectorAll('.trending-dot');
    if(!slides.length){ stopCarousel(); return; }
    slides[idx].classList.remove('active');
    dots[idx]?.classList.remove('active');
    idx = (idx+1) % slides.length;
    slides[idx].classList.add('active');
    dots[idx]?.classList.add('active');
  }, 5000);
}

// Reader-facing empty state for the feed. While Firestore hasn't sent its
// first snapshot yet, this is "loading", not "empty" — so readers should
// never see "no articles" or an admin-only "+ New Post" hint at that point.
function feedEmptyMessage(fallback){
  if(FIREBASE_READY && !firebaseHasLoaded) return 'Loading articles…';
  if(isAdmin()) return 'No posts in this category yet. Use "+ New Post" to add the first one.';
  return fallback;
}

function renderFeed(){
  const feed = document.getElementById('feed');
  const note = document.getElementById('filterNote');
  stopCarousel();
  let list = posts.slice();

  if(state.category !== 'all'){
    list = list.filter(p=>p.category===state.category);
    note.hidden = false;
    note.innerHTML = `Showing <b style="color:var(--chalk)">${CATEGORY_LABELS[state.category]}</b> only &middot; <button id="clearFilter">show all</button>`;
    document.getElementById('clearFilter').addEventListener('click', ()=>{
      setCategory('all');
    });
  } else {
    note.hidden = true;
  }

  if(state.sort === 'home'){
    const trendList = posts.filter(p=>p.trending).sort((a,b)=> toJSDate(b.date)-toJSDate(a.date));
    list.sort((a,b)=> (b.trending - a.trending) || (toJSDate(b.date)-toJSDate(a.date)));

    let html = buildCarouselHtml(trendList);
    if(list.length){
      html += `<div class="section-label">Latest Stories</div>`;
      html += list.map(p=>cardHtml(p)).join('');
    } else if(!trendList.length){
      html += `<div class="empty-state">${feedEmptyMessage('No articles yet — check back soon.')}</div>`;
    }
    feed.innerHTML = html;
    attachCardHandlers(feed);
    feed.querySelectorAll('.trending-slide').forEach(slide=>{
      slide.addEventListener('click', (e)=>{
        e.preventDefault();
        openArticle(slide.dataset.id);
      });
    });
    if(trendList.length) startCarousel(trendList.length);
    return;
  }

  // state.sort === 'trendingOnly' — only posts marked "trending" in the
  // dashboard, no carousel, newest first. Mirrors the app's Trending tab.
  list = list.filter(p=>p.trending);
  list.sort((a,b)=> toJSDate(b.date)-toJSDate(a.date));

  if(list.length === 0){
    feed.innerHTML = `<div class="empty-state">${feedEmptyMessage('No trending articles yet.')}</div>`;
    return;
  }

  feed.innerHTML = list.map(p=>cardHtml(p)).join('');
  attachCardHandlers(feed);
}

/* =========================================================
   SEARCH — same word-prefix matching used in the app: a word has to
   START WITH the query, not just contain it anywhere. That's what stops
   "reach" or "coach" from matching a search for "ch", while "Chelsea" or
   "Championship" still match correctly. Checks title, snippet, category,
   and tags (so team/player tags set in the writer form are searchable).
   ========================================================= */
function wordStartsWith(text, query){
  if(!text) return false;
  const words = String(text).toLowerCase().split(/[^a-z0-9]+/);
  return words.some(w=> w.startsWith(query));
}
function matchesSearch(post, query){
  const tagsText = Array.isArray(post.tags) ? post.tags.join(' ') : (post.tags || '');
  return wordStartsWith(post.title, query) ||
    wordStartsWith(post.snippet, query) ||
    wordStartsWith(post.category, query) ||
    wordStartsWith(tagsText, query);
}
function renderSearchResults(){
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const box = document.getElementById('searchResults');
  if(!query){
    box.innerHTML = `<div class="empty-state">Search for articles, teams, or players</div>`;
    return;
  }
  const results = posts.filter(p=> matchesSearch(p, query));
  if(!results.length){
    box.innerHTML = `<div class="empty-state">No articles found for &quot;${escapeHtml(query)}&quot;</div>`;
    return;
  }
  box.innerHTML = results.map(p=>cardHtml(p)).join('');
  attachCardHandlers(box);
}

/* =========================================================
   TICKER
   ========================================================= */
function buildTicker(){
  const items = posts.slice(0,6).map(p=>`<span><b>${CATEGORY_LABELS[p.category].toUpperCase()}</b> — ${escapeHtml(p.title)}</span>`).join('');
  document.getElementById('tickerTrack').innerHTML = items + items; // duplicate for seamless loop
}
