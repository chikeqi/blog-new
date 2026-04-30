// 旭儿导航 - #6 (添加文章标签功能)
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const kv = env.NAV_KV;

        if (path === '/admin') return handleAdmin(request, kv);
        if (path === '/logout') return handleLogout(request, kv);
        if (path.startsWith('/post/')) return handlePost(request, kv);
        if (path.startsWith('/api/')) return handleApi(request, kv);
        return handleHome(request, kv);
    }
};

async function handleHome(request, kv) {
    const url = new URL(request.url);
    const tagFilter = url.searchParams.get('tag') || '';
    
    let sites = [], posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }

    let publishedPosts = posts.filter(p => p.status === 'published');
    if (tagFilter) {
        publishedPosts = publishedPosts.filter(p => p.tags && p.tags.includes(tagFilter));
    }
    
    // 统计所有标签
    const tagCount = new Map();
    posts.forEach(p => {
        if (p.tags && p.status === 'published') {
            p.tags.forEach(tag => tagCount.set(tag, (tagCount.get(tag) || 0) + 1));
        }
    });
    const tagsList = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    
    const recentPosts = publishedPosts.slice(0, 5);
    
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>旭儿导航${tagFilter ? ' - ' + tagFilter : ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#f5f7fa;padding:20px}.container{max-width:1200px;margin:0 auto}.header{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:40px;border-radius:20px;margin-bottom:30px;text-align:center}.section{background:#fff;border-radius:16px;padding:24px;margin-bottom:24px}.section h2{margin-bottom:20px;font-size:20px;border-left:4px solid #667eea;padding-left:12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}.card{background:#f8f9fa;border-radius:12px;padding:16px}.card a{text-decoration:none;color:#333;display:block}.card h3{font-size:16px;color:#667eea}.post-item{border-bottom:1px solid #eee;padding:12px 0;display:flex;gap:16px;align-items:center}.post-cover{width:70px;height:50px;object-fit:cover;border-radius:8px;background:#e2e8f0}.post-info{flex:1}.post-title{font-weight:600;color:#333;text-decoration:none}.post-title:hover{color:#667eea}.post-meta{font-size:12px;color:#888;margin-top:6px}.tag-cloud{margin-bottom:20px;padding:16px;background:#f8f9fa;border-radius:12px}.tag-cloud a{display:inline-block;margin:4px 8px;text-decoration:none;color:#667eea}.tag-cloud a:hover{text-decoration:underline}.admin-btn{display:inline-block;margin-top:20px;background:#667eea;color:#fff;padding:10px 24px;border-radius:30px;text-decoration:none}.filter-bar{margin-bottom:16px}.filter-bar a{color:#667eea;text-decoration:none}
</style></head>
<body><div class="container"><div class="header"><h1>📚 旭儿导航</h1><p>精选网站 · 优质博客</p></div>
<div class="section"><h2>🏷️ 热门标签</h2><div class="tag-cloud">${tagsList.map(([tag, count]) => `<a href="/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)} (${count})</a>`).join('')}${tagsList.length === 0 ? '暂无标签' : ''}${tagFilter ? `<a href="/" style="margin-left:16px;color:#888">清除筛选</a>` : ''}</div></div>
<div class="section"><h2>📖 ${tagFilter ? `标签「${escapeHtml(tagFilter)}」相关文章` : '最新文章'}</h2>${recentPosts.map(p => `<div class="post-item">${p.coverImage ? `<img src="${escapeHtml(p.coverImage)}" class="post-cover" onerror="this.style.display='none'">` : '<div class="post-cover" style="display:flex;align-items:center;justify-content:center">📄</div>'}<div class="post-info"><a href="/post/${p.id}" class="post-title">${escapeHtml(p.title)}</a><div class="post-meta">${p.tags && p.tags.length ? p.tags.map(t => `#${escapeHtml(t)} `).join('') : ''}${p.category ? `· ${escapeHtml(p.category)}` : ''} · 📅 ${new Date(p.createdAt).toLocaleDateString()}</div></div></div>`).join('')}${recentPosts.length === 0 ? '<div style="padding:20px;text-align:center">暂无文章</div>' : ''}</div>
<div class="section"><h2>🔖 常用网站</h2><div class="grid">${sites.map(s => `<div class="card"><a href="${s.url}" target="_blank"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.catelog)}</p></a></div>`).join('')}${sites.length === 0 ? '<div style="padding:20px;text-align:center">暂无书签</div>' : ''}</div></div>
<div style="text-align:center"><a href="/admin" class="admin-btn">⚙️ 后台管理</a></div></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleAdmin(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    let isLoggedIn = false;
    if (match) {
        const session = await kv.get(`session:${match[1]}`);
        isLoggedIn = session !== null;
    }
    if (request.method === 'POST') {
        const form = await request.formData();
        const password = form.get('password');
        const adminPass = await kv.get('admin_password') || 'admin123';
        if (password === adminPass) {
            const token = crypto.randomUUID();
            await kv.put(`session:${token}`, 'active', { expirationTtl: 86400 });
            return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `admin_token=${token}; Path=/; HttpOnly; Max-Age=86400` } });
        }
        return new Response('密码错误，<a href="/admin">返回</a>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (!isLoggedIn) {
        return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>管理员登录</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;justify-content:center;align-items:center}.box{background:#fff;padding:40px;border-radius:20px;width:320px;text-align:center}input,button{width:100%;padding:12px;margin:10px 0;border-radius:8px;border:1px solid #ddd}button{background:#667eea;color:#fff;border:none;cursor:pointer}</style></head><body><div class="box"><h2>🔐 管理员登录</h2><form method="post"><input type="password" name="password" placeholder="请输入密码" required><button type="submit">登录</button></form></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    let sites = [], posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }
    return new Response(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>管理后台</title><style>
body{font-family:system-ui;background:#f5f7fa;padding:20px}.container{max-width:1200px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.card{background:#fff;border-radius:16px;padding:24px;margin-bottom:24px}.card h3{margin-bottom:16px}.form-group{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}.form-group input,.form-group textarea,.form-group select{flex:1;padding:10px;border:1px solid #ddd;border-radius:8px}.form-group textarea{width:100%}button{padding:10px 20px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer}.delete-btn{background:#e53e3e}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}th{background:#f8f9fa}.status-badge{padding:2px 8px;border-radius:12px;font-size:12px}.status-published{background:#d4edda;color:#155724}.status-draft{background:#fff3cd;color:#856404}.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);justify-content:center;align-items:center;z-index:1000}.modal-content{background:#fff;border-radius:16px;padding:24px;width:90%;max-width:600px}
</style></head>
<body><div class="container"><div class="header"><h1>📚 管理后台</h1><a href="/logout" style="color:#e53e3e">退出登录</a></div>
<div class="card"><h3>📝 发布文章</h3><div class="form-group"><input type="text" id="postTitle" placeholder="文章标题"></div><div class="form-group"><input type="text" id="postCategory" placeholder="分类"><input type="text" id="postTags" placeholder="标签（用逗号分隔，如：技术,生活）"><input type="url" id="postCoverImage" placeholder="封面图 URL"><select id="postStatus"><option value="published">发布</option><option value="draft">草稿</option></select></div><div class="form-group"><textarea id="postContent" rows="6" placeholder="文章内容..."></textarea></div><button onclick="addPost()">发布文章</button></div>
<div class="card"><h3>📖 文章列表</h3><div class="form-group"><input type="text" id="searchPost" placeholder="搜索文章..." onkeyup="searchPosts()"></div><table><thead><tr><th>标题</th><th>标签</th><th>分类</th><th>状态</th><th>日期</th><th>操作</th></tr></thead><tbody id="postList"></tbody></table></div>
<div class="card"><h3>➕ 添加书签</h3><div class="form-group"><input type="text" id="siteName" placeholder="网站名称"><input type="url" id="siteUrl" placeholder="网址"><input type="text" id="siteCat" placeholder="分类"><button onclick="addBookmark()">添加</button></div></div>
<div class="card"><h3>🔖 书签列表</h3><table><thead><tr><th>名称</th><th>网址</th><th>分类</th><th>操作</th></tr></thead><tbody id="bookmarkList"></tbody></table></div></div>
<div id="editModal" class="modal"><div class="modal-content"><div style="display:flex;justify-content:space-between"><h3>编辑文章</h3><span onclick="closeEditModal()" style="font-size:24px;cursor:pointer">&times;</span></div><input type="hidden" id="editId"><div class="form-group"><label>标题</label><input type="text" id="editTitle"></div><div class="form-group"><label>分类</label><input type="text" id="editCategory"></div><div class="form-group"><label>标签</label><input type="text" id="editTags" placeholder="用逗号分隔"></div><div class="form-group"><label>封面图 URL</label><input type="url" id="editCoverImage"></div><div class="form-group"><label>状态</label><select id="editStatus"><option value="published">发布</option><option value="draft">草稿</option></select></div><div class="form-group"><label>内容</label><textarea id="editContent" rows="8"></textarea></div><button onclick="saveEdit()">保存修改</button></div></div>
<script>
let allPosts = ${JSON.stringify(posts)};
let allSites = ${JSON.stringify(sites)};
function escape(str){return String(str).replace(/[&<>]/g,m=>m==='&'?'&amp;':m==='<'?'&lt;':m==='>'?'&gt;':m);}
function renderPosts(f){let list=f?allPosts.filter(p=>p.title.includes(f)):allPosts;document.getElementById('postList').innerHTML=list.map(p=>'<tr><td><strong>'+escape(p.title)+'</strong></td><td>'+(p.tags ? p.tags.map(t=>'#'+escape(t)).join(' ') : '-')+'</span></td><td>'+escape(p.category||'未分类')+'</span></td><td><span class="status-badge '+(p.status==='published'?'status-published':'status-draft')+'">'+(p.status==='published'?'已发布':'草稿')+'</span></td><td>'+new Date(p.createdAt).toLocaleDateString()+'</span></td><td><button onclick="openEditModal('+p.id+')" style="background:#ed8936">编辑</button> <button class="delete-btn" onclick="deletePost('+p.id+')">删除</button></td></tr>').join('');}
function searchPosts(){renderPosts(document.getElementById('searchPost').value);}
function openEditModal(id){let p=allPosts.find(p=>p.id===id);if(p){document.getElementById('editId').value=p.id;document.getElementById('editTitle').value=p.title;document.getElementById('editCategory').value=p.category||'';document.getElementById('editTags').value=(p.tags||[]).join(',');document.getElementById('editCoverImage').value=p.coverImage||'';document.getElementById('editStatus').value=p.status||'published';document.getElementById('editContent').value=p.content||'';document.getElementById('editModal').style.display='flex';}}
function closeEditModal(){document.getElementById('editModal').style.display='none';}
async function saveEdit(){let id=document.getElementById('editId').value;let title=document.getElementById('editTitle').value.trim();let category=document.getElementById('editCategory').value.trim();let tagsStr=document.getElementById('editTags').value.trim();let tags=tagsStr?tagsStr.split(',').map(t=>t.trim()).filter(t=>t):[];let coverImage=document.getElementById('editCoverImage').value.trim();let status=document.getElementById('editStatus').value;let content=document.getElementById('editContent').value;if(!title||!content){alert('请填写标题和内容');return;}let r=await fetch('/api/blog/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,category,tags,coverImage,status,content})});if(r.ok)location.reload();else alert('保存失败');}
async function addPost(){let title=document.getElementById('postTitle').value.trim();let category=document.getElementById('postCategory').value.trim();let tagsStr=document.getElementById('postTags').value.trim();let tags=tagsStr?tagsStr.split(',').map(t=>t.trim()).filter(t=>t):[];let coverImage=document.getElementById('postCoverImage').value.trim();let status=document.getElementById('postStatus').value;let content=document.getElementById('postContent').value;if(!title||!content){alert('请填写标题和内容');return;}let r=await fetch('/api/blog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,category,tags,coverImage,status,content})});if(r.ok)location.reload();else alert('发布失败');}
async function deletePost(id){if(!confirm('确定删除？'))return;let r=await fetch('/api/blog/'+id,{method:'DELETE'});if(r.ok)location.reload();else alert('删除失败');}
function renderBookmarks(){document.getElementById('bookmarkList').innerHTML=allSites.map(s=>'<tr><td><strong>'+escape(s.name)+'</strong><td><a href="'+escape(s.url)+'" target="_blank">'+escape(s.url)+'</a></td><td>'+escape(s.catelog)+'</span></td><td><button class="delete-btn" onclick="deleteBookmark('+s.id+')">删除</button></td></tr>').join('');}
async function addBookmark(){let name=document.getElementById('siteName').value.trim();let url=document.getElementById('siteUrl').value.trim();let catelog=document.getElementById('siteCat').value.trim();if(!name||!url||!catelog){alert('请填写完整');return;}let r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,url,catelog})});if(r.ok)location.reload();else alert('添加失败');}
async function deleteBookmark(id){if(!confirm('确定删除？'))return;let r=await fetch('/api/config/'+id,{method:'DELETE'});if(r.ok)location.reload();else alert('删除失败');}
renderPosts();renderBookmarks();
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleApi(request, kv) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/config') {
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        return new Response(JSON.stringify({ code: 200, data: sites }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/config') {
        const body = await request.json();
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        const newId = sites.length ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        sites.push({ id: newId, name: body.name, url: body.url, catelog: body.catelog });
        await kv.put('sites', JSON.stringify(sites));
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        await kv.put('sites', JSON.stringify(sites.filter(s => s.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'GET' && path === '/api/blog') {
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        return new Response(JSON.stringify({ code: 200, data: posts }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/blog') {
        const body = await request.json();
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        const newPost = { id: Date.now(), title: body.title, content: body.content, category: body.category || '未分类', tags: body.tags || [], coverImage: body.coverImage || '', status: body.status || 'published', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        posts.push(newPost);
        await kv.put('blog_posts', JSON.stringify(posts));
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'PUT' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        const body = await request.json();
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        const idx = posts.findIndex(p => p.id === id);
        if (idx !== -1) {
            posts[idx] = { ...posts[idx], title: body.title, content: body.content, category: body.category, tags: body.tags, coverImage: body.coverImage, status: body.status, updatedAt: new Date().toISOString() };
            await kv.put('blog_posts', JSON.stringify(posts));
        }
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        await kv.put('blog_posts', JSON.stringify(posts.filter(p => p.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ code: 404 }), { status: 404 });
}

async function handleLogout(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match) await kv.delete(`session:${match[1]}`);
    return new Response(null, { status: 302, headers: { 'Location': '/', 'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Max-Age=0' } });
}

async function handlePost(request, kv) {
    const url = new URL(request.url);
    const id = parseInt(url.pathname.split('/')[2]);
    if (isNaN(id)) return new Response('文章不存在', { status: 404 });
    let posts = [];
    try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
    const post = posts.find(p => p.id === id);
    if (!post || post.status !== 'published') return new Response('文章不存在', { status: 404 });
    let views = 0;
    try {
        const v = await kv.get(`views:${id}`);
        if (v) views = parseInt(v);
        views++;
        await kv.put(`views:${id}`, views.toString());
    } catch(e) { }
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(post.title)} - 旭儿导航</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#f5f7fa;padding:20px}.container{max-width:900px;margin:0 auto}.article{background:#fff;border-radius:20px;padding:40px}.cover-img{width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:24px}h1{font-size:28px;margin-bottom:16px}.meta{color:#888;font-size:14px;margin-bottom:30px;padding-bottom:16px;border-bottom:1px solid #eee}.tags{margin-top:8px}.tag{display:inline-block;background:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:12px;margin-right:8px}.content{line-height:1.8;font-size:16px}.back-btn{display:inline-block;margin-top:30px;background:#667eea;color:#fff;padding:10px 24px;border-radius:30px;text-decoration:none}</style></head><body><div class="container"><div class="article">${post.coverImage ? `<img src="${escapeHtml(post.coverImage)}" class="cover-img" onerror="this.style.display='none'">` : ''}<h1>${escapeHtml(post.title)}</h1><div class="meta">${post.category ? `分类：${escapeHtml(post.category)} · ` : ''}发布时间：${new Date(post.createdAt).toLocaleDateString()} · 阅读：${views}次${post.tags && post.tags.length ? `<div class="tags">${post.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}</div><div class="content">${post.content.replace(/\n/g, '<br>')}</div><a href="/" class="back-btn">← 返回首页</a></div></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
