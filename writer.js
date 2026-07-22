/* =========================================================
   RICH TEXT TOOLBAR
   ========================================================= */
document.querySelectorAll('.rich-toolbar button[data-cmd]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.getElementById('f_body_rich').focus();
    document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
    runSeoCheck();
  });
});

let savedBodyRange = null;
document.getElementById('insertImageBtn').addEventListener('click', ()=>{
  const sel = window.getSelection();
  if(sel.rangeCount > 0){
    const range = sel.getRangeAt(0);
    const editor = document.getElementById('f_body_rich');
    savedBodyRange = editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  }
  document.getElementById('bodyImageInput').click();
});

document.getElementById('bodyImageInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = new Image();
    img.onload = ()=>{
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

      const editor = document.getElementById('f_body_rich');
      editor.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      if(savedBodyRange){
        sel.addRange(savedBodyRange);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.addRange(range);
      }
      document.execCommand('insertImage', false, dataUrl);
      runSeoCheck();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

/* =========================================================
   "READ ALSO" INLINE ARTICLE LINKS
   Lets the writer select text (or place the cursor) in the body
   editor, pick another published post, and insert a normal-looking
   link — styled in floodlight gold — that opens that post inside
   the app-like single-page view when a reader clicks it, instead of
   navigating to a real URL.
   ========================================================= */
let savedLinkRange = null;

function openPostLinkPicker(){
  const sel = window.getSelection();
  const editor = document.getElementById('f_body_rich');
  if(sel.rangeCount > 0){
    const range = sel.getRangeAt(0);
    savedLinkRange = editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  } else {
    savedLinkRange = null;
  }
  document.getElementById('linkPickerSearch').value = '';
  renderLinkPickerList('');
  document.getElementById('overlay2').style.display = 'block';
  document.getElementById('linkPicker').hidden = false;
  document.getElementById('linkPickerSearch').focus();
}

function closePostLinkPicker(){
  document.getElementById('overlay2').style.display = 'none';
  document.getElementById('linkPicker').hidden = true;
}

function renderLinkPickerList(query){
  const list = document.getElementById('linkPickerList');
  const q = query.trim().toLowerCase();
  // Don't offer linking an article to itself while editing it.
  const candidates = posts
    .filter(p => p.id !== editingPostId)
    .filter(p => !q || p.title.toLowerCase().includes(q))
    .slice(0, 30);
  if(!candidates.length){
    list.innerHTML = `<div style="font-family:var(--mono);font-size:11px;color:var(--chalk-dim);padding:8px 2px;">No matching articles.</div>`;
    return;
  }
  list.innerHTML = candidates.map(p => `
    <button type="button" class="link-picker-item" data-id="${p.id}">
      ${escapeHtml(p.title)}
      <small>${CATEGORY_LABELS[p.category] || p.category}</small>
    </button>
  `).join('');
  list.querySelectorAll('.link-picker-item').forEach(btn=>{
    btn.addEventListener('click', ()=> insertPostLink(btn.dataset.id));
  });
}

function insertPostLink(postId){
  const post = posts.find(p=>p.id===postId);
  if(!post) return;

  const editor = document.getElementById('f_body_rich');
  editor.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  if(savedLinkRange){
    sel.addRange(savedLinkRange);
  } else {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.addRange(range);
  }

  // If the writer had text selected, keep using it as the link's visible
  // words (the "buried link" look); otherwise fall back to the target
  // article's own title so the inserted link never reads as empty.
  const selectedText = sel.toString().trim();
  const linkText = selectedText || post.title;
  const anchorHtml = `<a href="#" class="inline-post-link" data-post-id="${post.id}">${escapeHtml(linkText)}</a>`;
  document.execCommand('insertHTML', false, anchorHtml);
  runSeoCheck();
  closePostLinkPicker();
}

document.getElementById('insertPostLinkBtn').addEventListener('click', openPostLinkPicker);
document.getElementById('linkPickerCancel').addEventListener('click', closePostLinkPicker);
document.getElementById('overlay2').addEventListener('click', closePostLinkPicker);
document.getElementById('linkPickerSearch').addEventListener('input', (e)=> renderLinkPickerList(e.target.value));

/* =========================================================
   IMAGE UPLOAD — resized/compressed to a data URL client-side
   (no file storage backend, so the image travels inside the
   post itself; kept under ~1200px wide to stay well within
   Firestore's 1MB-per-document limit).
   ========================================================= */
let currentImageDataUrl = null;
document.getElementById('f_image_file').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = new Image();
    img.onload = ()=>{
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      currentImageDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const preview = document.getElementById('f_image_preview');
      preview.src = currentImageDataUrl;
      preview.hidden = false;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

/* =========================================================
   WRITER FORM — shared between "new post" and "edit post"
   ========================================================= */
let editingPostId = null;

function resetWriterForm(){
  editingPostId = null;
  document.getElementById('writerHeading').textContent = 'Write a new post';
  document.getElementById('publishBtn').textContent = 'Publish post';
  ['f_title','f_subtitle','f_meta','f_keyword','f_alt','f_snippet','f_tags'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('f_author').value = 'Footy Post Staff';
  document.getElementById('f_body_rich').innerHTML = '';
  document.getElementById('f_category').value = 'club';
  document.getElementById('f_trending').checked = false;
  document.getElementById('f_image_file').value = '';
  document.getElementById('f_image_preview').hidden = true;
  currentImageDataUrl = null;
  runSeoCheck();
}

function loadPostIntoWriter(post){
  editingPostId = post.id;
  document.getElementById('writerHeading').textContent = 'Edit post';
  document.getElementById('publishBtn').textContent = 'Save changes';
  document.getElementById('f_title').value = post.title || '';
  document.getElementById('f_subtitle').value = post.subtitle || '';
  document.getElementById('f_meta').value = post.metaDescription || post.snippet || '';
  document.getElementById('f_keyword').value = post.focusKeyword || '';
  document.getElementById('f_author').value = post.author || 'Footy Post Staff';
  document.getElementById('f_alt').value = post.imageAlt || '';
  document.getElementById('f_snippet').value = post.snippet || '';
  document.getElementById('f_tags').value = Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '');
  document.getElementById('f_category').value = post.category || 'club';
  document.getElementById('f_trending').checked = !!post.trending;
  currentImageDataUrl = post.image || null;
  const preview = document.getElementById('f_image_preview');
  if(post.image){ preview.src = post.image; preview.hidden = false; } else { preview.hidden = true; }
  document.getElementById('f_body_rich').innerHTML = bodyToHtml(post.body);
  runSeoCheck();
}

/* =========================================================
   SEO CHECKER
   ========================================================= */
const seoFields = ['f_title','f_meta','f_keyword','f_alt','f_snippet'];
seoFields.forEach(id=> document.getElementById(id).addEventListener('input', runSeoCheck));
document.getElementById('f_body_rich').addEventListener('input', runSeoCheck);

document.getElementById('f_title').addEventListener('input', (e)=>{
  document.getElementById('titleCount').textContent = e.target.value.length + ' characters';
});
document.getElementById('f_meta').addEventListener('input', (e)=>{
  document.getElementById('metaCount').textContent = e.target.value.length + ' characters';
});
document.getElementById('f_body_rich').addEventListener('input', ()=>{
  const words = wordCount(document.getElementById('f_body_rich').innerText);
  document.getElementById('bodyCount').textContent = words + ' words';
});

function wordCount(str){ return str.trim().split(/\s+/).filter(Boolean).length; }

function runSeoCheck(){
  const title = document.getElementById('f_title').value.trim();
  const meta = document.getElementById('f_meta').value.trim();
  const keyword = document.getElementById('f_keyword').value.trim().toLowerCase();
  const alt = document.getElementById('f_alt').value.trim();
  const body = document.getElementById('f_body_rich').innerText.trim();
  const bodyLower = body.toLowerCase();

  const checks = [];

  checks.push(scoreCheck(
    title.length >= 40 && title.length <= 60 ? 'good' : (title.length>0 ? 'warn':'bad'),
    'Title length',
    `${title.length} characters — aim for 40–60 so it doesn't get cut off in Google.`
  ));

  checks.push(scoreCheck(
    keyword && title.toLowerCase().includes(keyword) ? 'good' : 'bad',
    'Focus keyword in title',
    keyword ? (title.toLowerCase().includes(keyword) ? 'Found in title.' : 'Not found in title yet.') : 'Set a focus keyword first.'
  ));

  checks.push(scoreCheck(
    meta.length >= 120 && meta.length <= 160 ? 'good' : (meta.length>0 ? 'warn':'bad'),
    'Meta description length',
    `${meta.length} characters — aim for 120–160.`
  ));

  checks.push(scoreCheck(
    keyword && meta.toLowerCase().includes(keyword) ? 'good' : 'warn',
    'Focus keyword in meta description',
    keyword && meta.toLowerCase().includes(keyword) ? 'Found in meta description.' : 'Consider working it in naturally.'
  ));

  const wc = body ? wordCount(body) : 0;
  checks.push(scoreCheck(
    wc >= 300 ? 'good' : (wc>0 ? 'warn':'bad'),
    'Article length',
    `${wc} words — 300+ tends to rank better for news posts.`
  ));

  let density = 0;
  if(keyword && wc>0){
    const matches = bodyLower.split(keyword).length - 1;
    density = (matches / wc) * 100;
  }
  checks.push(scoreCheck(
    keyword ? (density>=0.5 && density<=2.5 ? 'good' : 'warn') : 'bad',
    'Keyword density in article',
    keyword ? `${density.toFixed(1)}% — aim for roughly 0.5%–2.5%, don't force it.` : 'Set a focus keyword first.'
  ));

  checks.push(scoreCheck(
    document.getElementById('f_body_rich').querySelector('h2') ? 'good' : 'warn',
    'Subheadings',
    document.getElementById('f_body_rich').querySelector('h2') ? 'At least one subheading found.' : 'Use the "Heading" button in the toolbar to break up the text.'
  ));

  checks.push(scoreCheck(
    alt.length > 0 ? 'good' : 'bad',
    'Image alt text',
    alt.length>0 ? 'Alt text is set.' : 'Describe the image for accessibility and image search.'
  ));

  const list = document.getElementById('seoChecks');
  list.innerHTML = checks.map(c=>`
    <li><span class="seo-dot" style="background:${dotColor(c.level)}"></span>
      <span><b>${c.label}</b> — ${c.detail}</span>
    </li>
  `).join('');

  const total = checks.reduce((sum,c)=> sum + (c.level==='good'?1:c.level==='warn'?0.5:0), 0);
  const score = Math.round((total/checks.length)*100);
  const circle = document.getElementById('seoScoreCircle');
  const label = document.getElementById('seoScoreLabel');
  circle.textContent = score;
  const color = score>=80?'good':score>=50?'warn':'bad';
  circle.style.borderColor = dotColor(color);
  circle.style.color = dotColor(color);
  label.innerHTML = (score>=80?'Looking green — ready to publish':score>=50?'Getting there — a few fixes left':'Needs work before publishing') + '<span>SEO score</span>';

  document.getElementById('publishBtn').disabled = !(title && body && meta);
  return score;
}
function scoreCheck(level,label,detail){ return {level,label,detail}; }
function dotColor(level){ return level==='good' ? 'var(--good)' : level==='warn' ? 'var(--warn)' : 'var(--bad)'; }

document.getElementById('publishBtn').addEventListener('click', ()=>{
  const title = document.getElementById('f_title').value.trim();
  const subtitle = document.getElementById('f_subtitle').value.trim();
  const meta = document.getElementById('f_meta').value.trim();
  const snippet = document.getElementById('f_snippet').value.trim() || meta;
  const bodyHtml = document.getElementById('f_body_rich').innerHTML.trim();
  const image = currentImageDataUrl || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1200&auto=format&fit=crop';
  const alt = document.getElementById('f_alt').value.trim();
  const category = document.getElementById('f_category').value;
  const author = document.getElementById('f_author').value.trim() || 'Footy Post Staff';
  const trending = document.getElementById('f_trending').checked;
  const focusKeyword = document.getElementById('f_keyword').value.trim();
  const tags = document.getElementById('f_tags').value
    .split(',')
    .map(t=>t.trim())
    .filter(Boolean);

  if(!title || !bodyHtml || !meta){ return; }

  const postData = {
    category, trending, author,
    title, subtitle, snippet, image, imageAlt: alt, metaDescription: meta, focusKeyword, tags,
    body: bodyHtml
  };

  if(editingPostId){
    updatePost(editingPostId, postData);
  } else {
    // Full timestamp (not just the date) so the app can show
    // "5 minutes ago" / "3 hours ago" style relative times.
    postData.date = new Date().toISOString();
    postData.likes = 0;
    postData.likedBy = [];
    postData.commentCount = 0;
    addPost(postData);
  }

  resetWriterForm();
  showFeed();
});
