/* =========================================================
   SIDEBAR
   ========================================================= */
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const hamburger = document.getElementById('hamburger');

function openSidebar(){
  sidebar.classList.add('open');
  overlay.classList.add('show');
  hamburger.classList.add('active');
  hamburger.setAttribute('aria-expanded','true');
}
function closeSidebar(){
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  hamburger.classList.remove('active');
  hamburger.setAttribute('aria-expanded','false');
}
hamburger.addEventListener('click', ()=> sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
overlay.addEventListener('click', closeSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);

function setCategory(cat){
  state.category = cat;
  document.querySelectorAll('.nav-item[data-cat]').forEach(n=>n.classList.toggle('active', n.dataset.cat===cat));
  document.querySelectorAll('.chip[data-cat]').forEach(n=>n.classList.toggle('active', n.dataset.cat===cat));
  showFeed();
  renderFeed();
}

document.querySelectorAll('.nav-item[data-cat]').forEach(el=>{
  el.addEventListener('click', (e)=>{
    e.preventDefault();
    closeSidebar();
    setCategory(el.dataset.cat);
  });
});
document.querySelector('.nav-item[data-cat="all"]').classList.add('active');

// Category chips — same destinations as the sidebar links, just a faster path
document.querySelectorAll('.chip[data-cat]').forEach(el=>{
  el.addEventListener('click', ()=> setCategory(el.dataset.cat));
});

// Sidebar footer links (Privacy Policy / Terms / About / Contact / Support)
// — same destinations the app's drawer opens.
document.querySelectorAll('.nav-item[data-link]').forEach(el=>{
  el.addEventListener('click', (e)=>{
    e.preventDefault();
    closeSidebar();
    window.open(el.dataset.link, '_blank', 'noopener');
  });
});

/* view tabs: Home (carousel + all latest stories) / Trending (only posts
   marked "trending" in the dashboard) — matches the app's Home/Trending tabs */
const tabHome = document.getElementById('tabHome');
const tabTrendingOnly = document.getElementById('tabTrendingOnly');

function activateTab(btn){
  [tabHome,tabTrendingOnly].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
tabHome.addEventListener('click', ()=>{ state.sort='home'; activateTab(tabHome); renderFeed(); });
tabTrendingOnly.addEventListener('click', ()=>{ state.sort='trendingOnly'; activateTab(tabTrendingOnly); renderFeed(); });

/* =========================================================
   VIEW SWITCHING
   ========================================================= */
function hideAllViews(){
  document.getElementById('feedView').hidden = true;
  document.getElementById('articleView').hidden = true;
  document.getElementById('writerView').hidden = true;
  document.getElementById('dashboardView').hidden = true;
  document.getElementById('searchView').hidden = true;
}
function showFeed(){ hideAllViews(); document.getElementById('feedView').hidden = false; }
function showArticle(){ hideAllViews(); document.getElementById('articleView').hidden = false; window.scrollTo(0,0); }
function showWriter(){ hideAllViews(); document.getElementById('writerView').hidden = false; window.scrollTo(0,0); }
function showDashboard(){ hideAllViews(); document.getElementById('dashboardView').hidden = false; window.scrollTo(0,0); renderDashboard(); }
function showSearch(){
  hideAllViews();
  document.getElementById('searchView').hidden = false;
  window.scrollTo(0,0);
  renderSearchResults();
  document.getElementById('searchInput').focus();
}

document.getElementById('backToFeed').addEventListener('click', ()=>{ showFeed(); stopReadStatusTimer(); stopCommentsListener(); });
document.getElementById('openWriter').addEventListener('click', ()=>{ resetWriterForm(); showWriter(); });
document.getElementById('sidebarWrite').addEventListener('click', ()=>{ closeSidebar(); resetWriterForm(); showWriter(); });
document.getElementById('backFromWriter').addEventListener('click', showFeed);
document.getElementById('cancelWriter').addEventListener('click', showFeed);
document.getElementById('openDashboard').addEventListener('click', showDashboard);
document.getElementById('backFromDashboard').addEventListener('click', showFeed);
document.getElementById('backFromSearch').addEventListener('click', showFeed);

// Search bar — opens the real search view.
document.getElementById('searchBarStub').addEventListener('click', showSearch);
document.getElementById('searchInput').addEventListener('input', renderSearchResults);

// "Read Also" links buried inside the article body (inserted via the
// writer's link picker) open that other post in-page instead of
// navigating anywhere — delegated once here since #articleContent's
// innerHTML gets replaced on every openArticle() call.
document.getElementById('articleContent').addEventListener('click', (e)=>{
  const link = e.target.closest('a.inline-post-link');
  if(!link) return;
  e.preventDefault();
  const targetId = link.dataset.postId;
  if(targetId) openArticle(targetId);
});

/* =========================================================
   FOOTER / BRAND FROM CONFIG
   ========================================================= */
document.getElementById('brandMark').innerHTML = CONFIG.siteName.replace(/(\S+)$/, '<em>$1</em>');
document.getElementById('footerYear').textContent = CONFIG.autoYear ? new Date().getFullYear() : CONFIG.copyrightYear;
document.getElementById('footerSiteName').textContent = CONFIG.siteName;

document.getElementById('resetContent').addEventListener('click', ()=>{
  if(FIREBASE_READY){
    alert('You\'re in shared (live) mode — posts live in Firestore now. Delete individual posts by opening them and using "Delete this post", or manage them from the Firebase console.');
    return;
  }
  if(!confirm('This clears everything you\'ve published in this browser and brings back the 6 sample posts. Continue?')) return;
  posts = SAMPLE_POSTS.slice();
  saveLocalPosts();
  buildTicker();
  renderFeed();
  showFeed();
});

document.getElementById('modeBadge').textContent = FIREBASE_READY ? '● Shared, live' : '● Local only';
document.getElementById('modeBadge').style.color = FIREBASE_READY ? 'var(--good)' : 'var(--chalk-dim)';

/* =========================================================
   INSTALLABLE APP (PWA)
   Needs manifest.json and sw.js sitting next to this file in
   the same repo — upload all three. Chrome/Edge/Android show the
   "Install App" button automatically once those are in place;
   Safari on iPhone/iPad doesn't support this prompt at all — on
   iOS, visitors add it via Share → "Add to Home Screen" manually,
   there's no code workaround for that Apple restriction.
   ========================================================= */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(err=> console.warn('Service worker failed to register:', err));
  });
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBtn').hidden = false;
});
document.getElementById('installBtn').addEventListener('click', async ()=>{
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBtn').hidden = true;
});
window.addEventListener('appinstalled', ()=>{ document.getElementById('installBtn').hidden = true; });

/* =========================================================
   INIT
   Each call is isolated so a failure in one (e.g. the ticker or an
   initial render glitch) can never prevent startPostsFeed() from
   running — that's the call that actually fetches articles, so it
   must always fire no matter what else goes wrong here.
   ========================================================= */
try{ buildTicker(); }catch(e){ console.error('buildTicker failed:', e); }
try{ renderFeed(); }catch(e){ console.error('renderFeed failed:', e); }
try{ runSeoCheck(); }catch(e){ console.error('runSeoCheck failed:', e); }
try{ renderSidebarAccount(); }catch(e){ console.error('renderSidebarAccount failed:', e); }
startPostsFeed();
