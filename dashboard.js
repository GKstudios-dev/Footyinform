function renderDashboard(){
  const box = document.getElementById('dashboardList');
  if(!posts.length){
    box.innerHTML = `<div class="empty-state">No posts yet — use "+ New Post" to write your first one.</div>`;
    return;
  }
  const sorted = posts.slice().sort((a,b)=> toJSDate(b.date) - toJSDate(a.date));
  box.innerHTML = sorted.map(p=>`
    <div class="dash-row">
      <img class="dash-thumb" src="${p.image}" alt="">
      <div class="dash-info">
        <div class="dash-title">${escapeHtml(p.title)}</div>
        <div class="dash-meta">${CATEGORY_LABELS[p.category]||p.category} · ${fmtDate(p.date)}</div>
      </div>
      <div class="dash-actions">
        <button class="edit-btn" data-id="${p.id}">Edit</button>
        <button class="del-btn" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join('');
  box.querySelectorAll('.edit-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const post = posts.find(p=>p.id===btn.dataset.id);
      if(post){ loadPostIntoWriter(post); showWriter(); }
    });
  });
  box.querySelectorAll('.del-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!confirm('Delete this post? This cannot be undone.')) return;
      if(FIREBASE_READY){
        db.collection('posts').doc(btn.dataset.id).delete().then(renderDashboard).catch(err=>alert('Could not delete: '+err.message));
      } else {
        posts = posts.filter(p=>p.id!==btn.dataset.id);
        saveLocalPosts();
        buildTicker(); renderFeed(); renderDashboard();
      }
    });
  });
}
