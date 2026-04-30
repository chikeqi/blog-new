// 旭儿导航 - #8 (恢复原首页布局：侧边栏 + Tab切换 + 搜索 + 分类筛选 + 暗色模式)
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
    const currentTab = url.searchParams.get('tab') || 'blog';
    const searchQuery = url.searchParams.get('q') || '';
    const currentTag = url.searchParams.get('tag') || '';
    const currentCat = url.searchParams.get('c') || '';
    
    let sites = [], posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }

    // 获取阅读量
    const viewsMap = new Map();
    for (const post of posts) {
        const views = await kv.get(`views:${post.id}`);
        if (views) viewsMap.set(post.id, parseInt(views));
    }
    
    // 分类统计
    const catMap = new Map();
    sites.forEach(s => {
        const cat = s.catelog || '未分类';
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const categories = Array.from(catMap.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const filteredSites = currentCat ? sites.filter(s => (s.catelog || '未分类') === currentCat) : sites;
    
    // 侧边栏分类HTML
    let catNavHtml = categories.map(cat => {
        const activeClass = currentCat === cat ? 'background:#667eea;color:white;font-weight:600' : '';
        return `<a href="/?tab=bookmark&c=${encodeURIComponent(cat)}" style="display:block;padding:10px 12px;margin:4px 0;border-radius:8px;text-decoration:none;color:#4a5568;${activeClass}">📁 ${escapeHtml(cat)} <span style="float:right;color:#a0aec0;font-size:12px">${catMap.get(cat)}</span></a>`;
    }).join('');
    
    // 书签卡片
    let cardsHtml = filteredSites.map(s => {
        const name = escapeHtml(s.name || '未命名');
        const url_clean = s.url.startsWith('http') ? s.url : 'https://' + s.url;
        const logo_clean = s.logo ? s.logo : '';
        const desc = escapeHtml(s.desc || '暂无描述');
        const cat = escapeHtml(s.catelog || '未分类');
        const initial = (s.name && s.name[0]) || '站';
        return `<div class="site-card"><a href="${url_clean}" target="_blank" style="text-decoration:none;color:inherit;display:block"><div style="display:flex;align-items:center;margin-bottom:12px">${logo_clean ? `<img src="${logo_clean}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;margin-right:14px">` : `<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;margin-right:14px">${initial}</div>`}<div style="flex:1"><h3 style="font-size:16px;font-weight:600;color:#2d3748;margin-bottom:4px">${name}</h3><span style="font-size:11px;color:#a0aec0;background:#f7fafc;padding:2px 8px;border-radius:12px">${cat}</span></div></div><p style="font-size:13px;color:#718096;margin-bottom:12px;line-height:1.4">${desc}</p><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:#a0aec0">${url_clean.replace(/^https?:\/\//, '').substring(0,30)}</span><button class="copy-btn" data-url="${url_clean}" style="background:#edf2f7;border:none;padding:5px 14px;border-radius:20px;font-size:11px;cursor:pointer">复制</button></div></a></div>`;
    }).join('');
    if (!cardsHtml) cardsHtml = '<div style="text-align:center;padding:60px">暂无书签</div>';
    
    // 博客筛选
    let blogPosts = posts.filter(p => p.status === 'published');
    if (searchQuery) {
        blogPosts = blogPosts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.content && p.content.toLowerCase().includes(searchQuery.toLowerCase())));
    }
    if (currentTag) {
        blogPosts = blogPosts.filter(p => p.tags && p.tags.includes(currentTag));
    }
    blogPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 标签云
    const tagMap = new Map();
    posts.forEach(post => {
        if (post.tags && post.status === 'published') {
            post.tags.forEach(tag => tagMap.set(tag, (tagMap.get(tag) || 0) + 1));
        }
    });
    const tagCloudHtml = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tag, count]) => {
        const size = Math.min(24, 12 + count * 2);
        return `<a href="/?tab=blog&tag=${encodeURIComponent(tag)}" style="display:inline-block;margin:4px;padding:4px 12px;background:#f0f0f0;border-radius:20px;text-decoration:none;color:#667eea;font-size:${size}px">#${escapeHtml(tag)} (${count})</a>`;
    }).join('');
    
    // 博客列表HTML
    let blogListHtml = blogPosts.map(post => {
        const views = viewsMap.get(post.id) || 0;
        return `<div class="blog-card" onclick="location.href='/post/${post.id}'"><div style="display:flex;justify-content:space-between;gap:16px"><div style="flex:1"><h3 style="font-size:18px;margin-bottom:8px;color:#2d3748">${escapeHtml(post.title)}</h3><div style="display:flex;gap:16px;margin:8px 0;font-size:12px;color:#a0aec0"><span>📅 ${new Date(post.createdAt).toLocaleDateString()}</span><span>🏷️ ${escapeHtml(post.category || '未分类')}</span><span>👁️ ${views}阅读</span>${post.tags && post.tags.length ? `<span>🏷️ ${post.tags.map(t => '#' + escapeHtml(t)).join(' ')}</span>` : ''}</div><p style="color:#718096;line-height:1.5">${escapeHtml(post.excerpt || (post.content || '').substring(0, 100).replace(/<[^>]*>/g, ''))}...</p></div>${post.coverImage ? `<img src="${escapeHtml(post.coverImage)}" style="width:100px;height:80px;object-fit:cover;border-radius:8px">` : ''}</div></div>`;
    }).join('');
    if (!blogListHtml) blogListHtml = '<div style="text-align:center;padding:60px">暂无文章</div>';
    
    // 热门文章侧边栏
    const hotPosts = [...posts.filter(p => p.status === 'published')].sort((a, b) => (viewsMap.get(b.id) || 0) - (viewsMap.get(a.id) || 0)).slice(0, 5);
    const hotPostsHtml = hotPosts.map(p => `<a href="/post/${p.id}" style="display:block;padding:8px 12px;margin:4px 0;border-radius:8px;text-decoration:none;color:#4a5568;font-size:13px;background:#f8fafc">🔥 ${escapeHtml(p.title.length > 20 ? p.title.substring(0,20)+'...' : p.title)} <span style="float:right;color:#a0aec0">${viewsMap.get(p.id) || 0}阅</span></a>`).join('');
    
    const siteTitle = await kv.get('site_title') || '旭儿导航';
    const siteSubtitle = await kv.get('site_subtitle') || '精选网站 · 优质博客';
    const logo = await kv.get('site_logo') || '';
    const logoLink = await kv.get('site_logo_link') || '';
    const headerBg = await kv.get('header_bg') || '';
    
    let logoHtml = '';
    if (logo) {
        logoHtml = logoLink ? `<a href="${escapeHtml(logoLink)}" target="_blank"><img src="${escapeHtml(logo)}" style="max-width:200px;max-height:240px"></a>` : `<img src="${escapeHtml(logo)}" style="max-width:200px;max-height:240px">`;
    } else {
        logoHtml = `<div style="font-size:28px;font-weight:bold;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(siteTitle)}</div>`;
    }
    
    const title = currentTab === 'blog' ? (searchQuery ? `搜索: ${escapeHtml(searchQuery)}` : '博客文章') : (currentCat ? `${escapeHtml(currentCat)} · ${filteredSites.length}个网站` : `全部收藏 · ${sites.length}个网站`);
    
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(siteTitle)} · ${currentTab === 'blog' ? '博客' : '书签'}</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:system-ui;background:#f7fafc;transition:background 0.3s}
        .sidebar{position:fixed;left:0;top:0;width:280px;height:100vh;background:white;box-shadow:2px 0 12px rgba(0,0,0,0.05);overflow-y:auto;z-index:100;transition:transform 0.3s}
        .sidebar-header{padding:20px;text-align:center;border-bottom:1px solid #e2e8f0}
        .sidebar-nav{padding:20px}
        .main{margin-left:280px;min-height:100vh}
        .header{position:relative;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:50px 40px 50px 60px;text-align:left;overflow:hidden}
        .header-bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
        .header-content{position:relative;z-index:2}
        .header h1{font-size:42px;margin-bottom:12px}
        .content{max-width:1300px;margin:0 auto;padding:35px 30px}
        .content-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;flex-wrap:wrap}
        .content-header h2{font-size:22px;color:#2d3748}
        .tab-buttons{display:flex;gap:10px}
        .tab-btn{padding:8px 20px;border:none;border-radius:30px;cursor:pointer}
        .tab-btn.active{background:#667eea;color:white}
        .tab-btn:not(.active){background:#e2e8f0}
        .sites-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:24px}
        .site-card,.blog-card{background:white;border-radius:12px;padding:16px;margin-bottom:20px;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s}
        .site-card:hover,.blog-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,0.1)}
        .search-box{margin-bottom:20px}
        .search-box input{width:100%;padding:12px 16px;border:1px solid #ddd;border-radius:30px;font-size:14px}
        .tag-cloud{margin-bottom:20px;padding:15px;background:#f8fafc;border-radius:12px}
        .mobile-toggle{display:none;position:fixed;top:15px;left:15px;z-index:101;background:white;border:none;padding:10px;border-radius:10px;cursor:pointer}
        .dark-mode-toggle{position:fixed;bottom:20px;right:20px;background:#667eea;color:white;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:1000;font-size:20px}
        .go-top{position:fixed;bottom:20px;left:20px;background:#667eea;color:white;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:1000;display:none;font-size:20px}
        body.dark{background:#1a1a2e}
        body.dark .sidebar{background:#16213e;color:#eee}
        body.dark .site-card,body.dark .blog-card{background:#16213e;color:#eee}
        body.dark .content-header h2{color:#eee}
        body.dark .tag-cloud{background:#0f3460}
        body.dark .copy-btn{background:#2d3748!important;color:#a0aec0}
        @media (max-width:768px){
            .sidebar{transform:translateX(-100%)}
            .sidebar.open{transform:translateX(0)}
            .main{margin-left:0}
            .mobile-toggle{display:block}
            .header h1{font-size:28px}
        }
    </style>
</head>
<body>
    <button class="mobile-toggle" id="mobileToggle">☰</button>
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">${logoHtml}</div>
        <div class="sidebar-nav">
            <a href="/?tab=blog" style="display:block;padding:10px;background:#e2e8f0;border-radius:8px;text-align:center;margin-bottom:15px;text-decoration:none;color:#667eea;font-weight:600">📝 博客列表</a>
            <div style="font-weight:600;margin:15px 0 10px">📁 书签分类</div>
            ${catNavHtml || '<div>暂无分类</div>'}
            <div style="font-weight:600;margin:20px 0 10px">🔥 热门文章</div>
            ${hotPostsHtml || '<div>暂无</div>'}
            <div style="margin-top:20px;padding-top:15px;border-top:1px solid #e2e8f0"><a href="/admin" style="display:block;padding:10px;background:#edf2f7;border-radius:8px;text-align:center;text-decoration:none">⚙️ 后台管理</a></div>
        </div>
    </div>
    <div class="main">
        <div class="header">${headerBg ? `<img class="header-bg-img" src="${escapeHtml(headerBg)}">` : ''}<div class="header-content"><h1>${escapeHtml(siteTitle)}</h1><p>${escapeHtml(siteSubtitle)}</p><div>📅 ${new Date().toLocaleDateString('zh-CN')}</div></div></div>
        <div class="content">
            <div class="content-header"><h2>${title}</h2><div class="tab-buttons"><button class="tab-btn ${currentTab === 'blog' ? 'active' : ''}" data-tab="blog">📝 博客</button><button class="tab-btn ${currentTab === 'bookmark' ? 'active' : ''}" data-tab="bookmark">🔖 书签</button></div></div>
            <div id="blog-view" style="display:${currentTab === 'blog' ? 'block' : 'none'}">
                <div class="search-box"><form id="searchForm" onsubmit="event.preventDefault();let u=new URL(location.href);u.searchParams.set('q',this.q.value);u.searchParams.delete('page');location.href=u"><input type="text" name="q" placeholder="🔍 搜索文章..." value="${escapeHtml(searchQuery)}"></form></div>
                ${tagCloudHtml ? `<div class="tag-cloud"><strong>🏷️ 热门标签：</strong> ${tagCloudHtml}</div>` : ''}
                ${blogListHtml}
            </div>
            <div id="bookmark-view" style="display:${currentTab === 'bookmark' ? 'block' : 'none'}"><div class="sites-grid">${cardsHtml}</div></div>
        </div>
    </div>
    <button class="dark-mode-toggle" id="darkModeToggle">🌙</button>
    <button class="go-top" id="goTop">↑</button>
    <script>
        document.getElementById('mobileToggle').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
        document.querySelectorAll('.copy-btn').forEach(btn=>btn.onclick=e=>{e.preventDefault();navigator.clipboard.writeText(btn.dataset.url);btn.textContent='✓';setTimeout(()=>btn.textContent='复制',1000)});
        document.querySelectorAll('.tab-btn').forEach(btn=>btn.onclick=()=>{let u=new URL(location.href);u.searchParams.set('tab',btn.dataset.tab);u.searchParams.delete('c');u.searchParams.delete('q');u.searchParams.delete('tag');location.href=u});
        const darkToggle=document.getElementById('darkModeToggle');if(localStorage.getItem('darkMode')==='true')document.body.classList.add('dark');darkToggle.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('darkMode',document.body.classList.contains('dark'));darkToggle.textContent=document.body.classList.contains('dark')?'☀️':'🌙'};
        const goTop=document.getElementById('goTop');window.onscroll=()=>goTop.style.display=window.scrollY>300?'block':'none';goTop.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
    </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
<head><meta charset="UTF-8"><title>管理后台</title>
<style>
body{font-family:system-ui;background:#f5f7fa;padding:20px}.container{max-width:1200px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.card{background:#fff;border-radius:16px;padding:24px;margin-bottom:24px}.card h3{margin-bottom:16px}.form-group{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}.form-group input,.form-group textarea,.form-group select{flex:1;padding:10px;border:1px solid #ddd;border-radius:8px}.form-group textarea{width:100%}button{padding:10px 20px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer}.delete-btn{background:#e53e3e}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}th{background:#f8f9fa}.status-badge{padding:2px 8px;border-radius:12px;font-size:12px}.status-published{background:#d4edda;color:#155724}.status-draft{background:#fff3cd;color:#856404}.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);justify-content:center;align-items:center;z-index:1000}.modal-content{background:#fff;border-radius:16px;padding:24px;width:90%;max-width:600px}
</style></head>
<body><div class="container"><div class="header"><h1>📚 管理后台</h1><a href="/logout" style="color:#e53e3e">退出登录</a></div>
<div class="card"><h3>📝 发布文章</h3><div class="form-group"><input type="text" id="postTitle" placeholder="文章标题"></div><div class="form-group"><input type="text" id="postCategory" placeholder="分类"><input type="text" id="postTags" placeholder="标签（用逗号分隔）"><input type="url" id="postCoverImage" placeholder="封面图 URL"><select id="postStatus"><option value="published">发布</option><option value="draft">草稿</option></select></div><div class="form-group"><textarea id="postContent" rows="6" placeholder="文章内容..."></textarea></div><button onclick="addPost()">发布文章</button></div>
<div class="card"><h3>📖 文章列表</h3><div class="form-group"><input type="text" id="searchPost" placeholder="搜索文章..." onkeyup="searchPosts()"></div>
<table><thead><tr><th>标题</th><th>标签</th><th>分类</th><th>状态</th><th>日期</th><th>操作</th></tr></thead><tbody id="postList"></tbody></table></div>
<div class="card"><h3>➕ 添加书签</h3><div class="form-group"><input type="text" id="siteName" placeholder="网站名称"><input type="url" id="siteUrl" placeholder="网址"><input type="text" id="siteCat" placeholder="分类"><button onclick="addBookmark()">添加</button></div></div>
<div class="card"><h3>🔖 书签列表</h3><table><thead><tr><th>名称</th><th>网址</th><th>分类</th><th>操作</th></tr></thead><tbody id="bookmarkList"></tbody></table></div></div>
<div id="editModal" class="modal"><div class="modal-content"><div style="display:flex;justify-content:space-between"><h3>编辑文章</h3><span onclick="closeEditModal()" style="font-size:24px;cursor:pointer">&times;</span></div><input type="hidden" id="editId"><div class="form-group"><label>标题</label><input type="text" id="editTitle"></div><div class="form-group"><label>分类</label><input type="text" id="editCategory"></div><div class="form-group"><label>标签</label><input type="text" id="editTags" placeholder="用逗号分隔"></div><div class="form-group"><label>封面图 URL</label><input type="url" id="editCoverImage"></div><div class="form-group"><label>状态</label><select id="editStatus"><option value="published">发布</option><option value="draft">草稿</option></select></div><div class="form-group"><label>内容</label><textarea id="editContent" rows="8"></textarea></div><button onclick="saveEdit()">保存修改</button></div></div>
<script>
let allPosts = ${JSON.stringify(posts)};
let allSites = ${JSON.stringify(sites)};
function escape(str){if(!str)return '';return String(str).replace(/[&<>]/g,function(m){if(m==='&')return'&amp;';if(m==='<')return'&lt;';if(m==='>')return'&gt;';return m;});}
function renderPosts(f){let list=f?allPosts.filter(p=>p.title.includes(f)):allPosts;let tbody=document.getElementById('postList');if(tbody){tbody.innerHTML=list.map(p=>'<tr><td><strong>'+escape(p.title)+'</strong></td><td>'+(p.tags?p.tags.map(t=>'#'+escape(t)).join(' '):'-')+'</td><td>'+escape(p.category||'未分类')+'</td><td><span class="status-badge '+(p.status==='published'?'status-published':'status-draft')+'">'+(p.status==='published'?'已发布':'草稿')+'</span></td><td>'+new Date(p.createdAt).toLocaleDateString()+'</td><td><button onclick="openEditModal('+p.id+')" style="background:#ed8936">编辑</button> <button class="delete-btn" onclick="deletePost('+p.id+')">删除</button></td></tr>').join('');}}
function searchPosts(){renderPosts(document.getElementById('searchPost').value);}
function openEditModal(id){let p=allPosts.find(p=>p.id==id);if(p){document.getElementById('editId').value=p.id;document.getElementById('editTitle').value=p.title;document.getElementById('editCategory').value=p.category||'';document.getElementById('editTags').value=(p.tags||[]).join(',');document.getElementById('editCoverImage').value=p.coverImage||'';document.getElementById('editStatus').value=p.status||'published';document.getElementById('editContent').value=p.content||'';document.getElementById('editModal').style.display='flex';}}
function closeEditModal(){document.getElementById('editModal').style.display='none';}
async function saveEdit(){let id=document.getElementById('editId').value;let title=document.getElementById('editTitle').value.trim();let category=document.getElementById('editCategory').value.trim();let tagsStr=document.getElementById('editTags').value.trim();let tags=tagsStr?tagsStr.split(',').map(t=>t.trim()).filter(t=>t):[];let coverImage=document.getElementById('editCoverImage').value.trim();let status=document.getElementById('editStatus').value;let content=document.getElementById('editContent').value;if(!title||!content){alert('请填写标题和内容');return;}let r=await fetch('/api/blog/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,category,tags,coverImage,status,content})});if(r.ok)location.reload();else alert('保存失败');}
async function addPost(){let title=document.getElementById('postTitle').value.trim();let category=document.getElementById('postCategory').value.trim();let tagsStr=document.getElementById('postTags').value.trim();let tags=tagsStr?tagsStr.split(',').map(t=>t.trim()).filter(t=>t):[];let coverImage=document.getElementById('postCoverImage').value.trim();let status=document.getElementById('postStatus').value;let content=document.getElementById('postContent').value;if(!title||!content){alert('请填写标题和内容');return;}let r=await fetch('/api/blog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,category,tags,coverImage,status,content})});if(r.ok)location.reload();else alert('发布失败');}
async function deletePost(id){if(!confirm('确定删除？'))return;let r=await fetch('/api/blog/'+id,{method:'DELETE'});if(r.ok)location.reload();else alert('删除失败');}
function renderBookmarks(){let tbody=document.getElementById('bookmarkList');if(tbody){tbody.innerHTML=allSites.map(s=>'<tr><td><strong>'+escape(s.name)+'</strong></td><td><a href="'+escape(s.url)+'" target="_blank">'+escape(s.url)+'</a></td><td>'+escape(s.catelog)+'</td><td><button class="delete-btn" onclick="deleteBookmark('+s.id+')">删除</button></td></tr>').join('');}}
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
