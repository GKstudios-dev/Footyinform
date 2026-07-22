const CONFIG = {
  siteName: "The Football Post",   // <-- change the whole site's name here, nowhere else needed
  copyrightYear: 2026,        // change this each year, or leave autoYear on below
  autoYear: true              // if true, footer year updates itself automatically
};

const CATEGORY_LABELS = { club: "Club", national: "National Team", transfers: "Transfers" };

/* =========================================================
   SAMPLE POSTS — replace with your own. Each post:
   id, category, title, snippet, image, imageAlt, date (ISO),
   trending (bool), body (array of paragraph/heading strings)
   ========================================================= */
const STORAGE_KEY = "footy-inform-posts-v1";

const SAMPLE_POSTS = [
  {
    id: "p1", category: "transfers", trending: true,
    title: "Ironbridge United close in on club-record deal for winger",
    snippet: "The Championship-chasing side are one medical away from smashing their transfer ceiling for a 22-year-old wide man.",
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Football players challenging for the ball during a match",
    date: "2026-07-09",
    body: [
      "Ironbridge United are closing in on what would become the club's record signing, with a fee understood to be in the region of £14m plus add-ons agreed in principle.",
      "## What's driving the deal",
      "The winger managed 11 goals and 9 assists last season, and the club's recruitment team have reportedly tracked him since he was 19.",
      "A medical is expected early next week, with the move likely to be confirmed before the transfer window's midpoint."
    ]
  },
  {
    id: "p2", category: "club", trending: true,
    title: "Coastal Rovers grind out a gritty away point after late equaliser",
    snippet: "A stoppage-time header rescued a point on the road, extending the unbeaten run to six matches.",
    image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Player heading the ball during a football match",
    date: "2026-07-08",
    body: [
      "Coastal Rovers came from behind to snatch a 1-1 draw in the closing minutes, with the captain rising highest from a corner to level the score.",
      "## Manager's take",
      "The head coach praised the squad's resilience after a difficult first half, pointing to fitness levels as a deciding factor late on.",
      "The result keeps Rovers three points off the top of the table with a game in hand."
    ]
  },
  {
    id: "p3", category: "national", trending: false,
    title: "Squad announced for upcoming World Cup qualifiers",
    snippet: "Two uncapped players make the cut as the manager rings the changes ahead of back-to-back qualifiers.",
    image: "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "National team players training on the pitch",
    date: "2026-07-06",
    body: [
      "The head coach named a 26-man squad on Thursday for the double-header of World Cup qualifiers, handing first call-ups to two uncapped players.",
      "## Talking points",
      "The reshuffled midfield reflects a shift toward a more possession-based approach after recent criticism of the team's build-up play.",
      "The first qualifier kicks off next Friday, with the return leg four days later."
    ]
  },
  {
    id: "p4", category: "transfers", trending: false,
    title: "Gossip column: the six names being linked with a January move",
    snippet: "From a proven goalscorer to a raw teenage prospect — here's who's being talked about this week.",
    image: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Football on the centre spot of a stadium pitch",
    date: "2026-07-05",
    body: [
      "As always, take gossip-column links with a pinch of salt — but here's what's circulating this week among agents and scouts.",
      "## The headline name",
      "A proven top-flight goalscorer has reportedly told friends he'd consider a fresh challenge if the right project came along.",
      "Further down the list, a teenage prospect from the lower leagues continues to attract attention from several bigger clubs' scouting networks."
    ]
  },
  {
    id: "p5", category: "club", trending: false,
    title: "Youth academy graduate handed full debut this weekend",
    snippet: "The 18-year-old midfielder has been in electric form for the reserves and now gets his senior chance.",
    image: "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Young football player controlling the ball",
    date: "2026-07-03",
    body: [
      "An academy graduate will make his first senior start this weekend after a string of impressive performances for the club's reserve side.",
      "## A long road",
      "The midfielder joined the academy at age eight and has progressed through every age group, captaining the under-18s to a league title last season.",
      "The manager described him as ready, adding that opportunities like this are exactly what the academy is built for."
    ]
  },
  {
    id: "p6", category: "national", trending: false,
    title: "Veteran defender confirms international retirement after 94 caps",
    snippet: "A near-two-decade international career comes to a close after this summer's tournament.",
    image: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Veteran football player on the pitch during a national team match",
    date: "2026-06-30",
    body: [
      "The long-serving defender confirmed his international retirement in a statement on Tuesday, closing the book on a 94-cap career spanning three tournament cycles.",
      "## Legacy",
      "He captained the side to a semi-final finish and is widely regarded as one of the most consistent defenders of his generation.",
      "The federation confirmed a testimonial match will be arranged later this year."
    ]
  }
];

/* =========================================================
   PERSISTENCE
   - If Firebase is configured: posts live in Firestore and every
     visitor sees the same list, updated live.
   - If not: posts are saved to this browser's local storage only
     (survives refresh, but nobody else sees them).
   ========================================================= */
function loadLocalPosts(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length) return parsed;
    }
  }catch(e){ /* storage unavailable or corrupted — fall back to sample posts */ }
  return null;
}
function saveLocalPosts(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }
  catch(e){ console.warn('Could not save posts to this browser:', e); }
}

let posts = FIREBASE_READY ? [] : (loadLocalPosts() || SAMPLE_POSTS.slice());
let firebaseHasLoaded = false;

function startPostsFeed(){
  if(!FIREBASE_READY) return;
  db.collection('posts').orderBy('date','desc').onSnapshot(
    snapshot=>{
      firebaseHasLoaded = true;
      posts = snapshot.empty ? [] : snapshot.docs.map(d=>({ id:d.id, ...d.data() }));
      buildTicker();
      renderFeed();
      // if the article view is currently open, refresh its read-status line too
      if(!document.getElementById('articleView').hidden && currentOpenArticleId){
        refreshReadStatusUI(currentOpenArticleId);
      }
    },
    err=>{
      console.warn('Could not reach the shared database, using this browser\'s local posts instead:', err);
      posts = loadLocalPosts() || SAMPLE_POSTS.slice();
      buildTicker();
      renderFeed();
    }
  );
}

function addPost(newPost){
  if(FIREBASE_READY){
    db.collection('posts').add(newPost).catch(err=>alert('Could not publish — check your Firebase setup.\n\n'+err.message));
  } else {
    posts.unshift({ id: 'p' + Date.now(), ...newPost });
    saveLocalPosts();
    buildTicker();
    renderFeed();
  }
}

function updatePost(id, updatedFields){
  if(FIREBASE_READY){
    db.collection('posts').doc(id).update(updatedFields).catch(err=>alert('Could not save changes — check your Firebase setup.\n\n'+err.message));
  } else {
    const idx = posts.findIndex(p=>p.id===id);
    if(idx > -1) posts[idx] = { ...posts[idx], ...updatedFields };
    saveLocalPosts();
    buildTicker();
    renderFeed();
  }
}

function deletePost(id){
  if(!confirm('Delete this post? This cannot be undone.')) return;
  if(FIREBASE_READY){
    db.collection('posts').doc(id).delete().catch(err=>alert('Could not delete: '+err.message));
  } else {
    posts = posts.filter(p=>p.id!==id);
    saveLocalPosts();
    buildTicker();
    renderFeed();
  }
  showFeed();
}

/* =========================================================
   STATE
   ========================================================= */
let state = { category: "all", sort: "home" };

/* =========================================================
   SHARED DATE / TIME HELPERS
   ========================================================= */
// The app (Flutter/cloud_firestore) can save date-like fields as Firestore
// Timestamp objects, while this site saves them as ISO strings. Firestore's
// web SDK hands those back as objects with a .toDate() method, not strings —
// calling string methods on one throws and silently breaks the whole feed
// render. This normalizes any of those shapes into a real JS Date first.
function toJSDate(value){
  if(value === null || value === undefined) return new Date(NaN);
  if(value instanceof Date) return value;
  if(typeof value === 'string'){
    return value.includes('T') ? new Date(value) : new Date(value+'T00:00:00');
  }
  if(typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  if(typeof value.seconds === 'number') return new Date(value.seconds*1000); // plain {seconds,nanoseconds}
  return new Date(value);
}

function fmtDate(iso){
  const d = toJSDate(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

function timeAgo(iso){
  const d = toJSDate(iso);
  if(isNaN(d.getTime())) return 'Just now';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if(seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return `${minutes} minute${minutes===1?'':'s'} ago`;
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return `${hours} hour${hours===1?'':'s'} ago`;
  const days = Math.floor(hours / 24);
  if(days < 7) return `${days} day${days===1?'':'s'} ago`;
  const weeks = Math.floor(days / 7);
  if(days < 30) return `${weeks} week${weeks===1?'':'s'} ago`;
  const months = Math.floor(days / 30);
  if(days < 365) return `${months} month${months===1?'':'s'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years===1?'':'s'} ago`;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
