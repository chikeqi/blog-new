// Cloudflare Pages Worker - 旭儿综合网站
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const kv = env.NAV_KV;

        if (path === '/admin') return handleAdmin(request, kv);
        if (path === '/logout') return handleLogout(request, kv);
        if (path.startsWith('/post/')) return handlePost(request, kv);
        if (path.startsWith('/api/upload')) return handleUpload(request, kv);
        if (path.startsWith('/api/image/')) return handleImage(request, kv);
        if (path.startsWith('/api/images')) return handleImagesApi(request, kv);
        if (path.startsWith('/api/')) return handleApi(request, kv);
        return handleHome(request, kv);
    }
};

// ==================== 首页 ====================
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

    sites.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999));

    const viewsMap = new Map();
    for (const post of posts) {
        const views = await kv.get(`views:${post.id}`);
        if (views) viewsMap.set(post.id, parseInt(views));
    }
    
    const catMap = new Map();
    sites.forEach(s => {
        const cat = s.catelog || '未分类';
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const categories = Array.from(catMap.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const filteredSites = currentCat ? sites.filter(s => (s.catelog || '未分类') === currentCat) : sites;
    
    const catNavHtml = categories.map(cat => {
        const activeClass = currentCat === cat ? 'background:#667eea;color:white;font-weight:600' : '';
        return `<a href="/?tab=bookmark&c=${encodeURIComponent(cat)}" style="display:block;padding:12px 12px;margin:4px 0;border-radius:8px;text-decoration:none;color:#4a5568;${activeClass}">📁 ${escapeHtml(cat)} <span style="float:right;color:#a0aec0;font-size:12px">${catMap.get(cat)}</span></a>`;
    }).join('');
    
    const cardsHtml = filteredSites.map(s => {
        const name = escapeHtml(s.name || '未命名');
        const urlClean = s.url && s.url.startsWith('http') ? s.url : 'https://' + (s.url || '');
        const logoClean = s.logo || '';
        const desc = escapeHtml(s.desc || '暂无描述');
        const cat = escapeHtml(s.catelog || '未分类');
        const initial = (s.name && s.name[0]) || '站';
        return `<div class="site-card"><a href="${urlClean}" target="_blank" style="text-decoration:none;color:inherit;display:block"><div style="display:flex;align-items:center;margin-bottom:12px">${logoClean ? `<img src="${logoClean}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;margin-right:14px">` : `<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;margin-right:14px">${initial}</div>`}<div style="flex:1"><h3 style="font-size:16px;font-weight:600;color:#2d3748;margin-bottom:4px">${name}</h3><span style="font-size:11px;color:#a0aec0;background:#f7fafc;padding:2px 8px;border-radius:12px">${cat}</span></div></div><p style="font-size:13px;color:#718096;margin-bottom:12px;line-height:1.4">${desc}</p><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:#a0aec0">${urlClean.replace(/^https?:\/\//, '').substring(0,30)}</span><button class="copy-btn" data-url="${urlClean}" style="background:#edf2f7;border:none;padding:5px 14px;border-radius:20px;font-size:11px;cursor:pointer">复制</button></div></a></div>`;
    }).join('');
    
    let blogPosts = posts.filter(p => p.status === 'published');
    if (searchQuery) {
        blogPosts = blogPosts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.content && p.content.toLowerCase().includes(searchQuery.toLowerCase())));
    }
    if (currentTag) {
        blogPosts = blogPosts.filter(p => p.tags && p.tags.includes(currentTag));
    }
    blogPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
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
    
    const recentPosts = blogPosts.slice(0, 10);
    const blogListHtml = recentPosts.map(post => {
        const views = viewsMap.get(post.id) || 0;
        const excerptText = (post.excerpt || (post.content || '')).replace(/<[^>]*>/g, '').substring(0, 100);
        const coverImgHtml = (post.coverImage && post.coverImage.trim() !== '') 
            ? `<img src="${escapeHtml(post.coverImage)}" style="width:100px;height:80px;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">` 
            : '';
        return `<div class="blog-card" onclick="location.href='/post/${post.id}'"><div style="display:flex;justify-content:space-between;gap:16px"><div style="flex:1"><h3 style="font-size:18px;margin-bottom:8px;color:#2d3748">${escapeHtml(post.title)}</h3><div style="display:flex;gap:16px;margin:8px 0;font-size:12px;color:#a0aec0"><span>📅 ${new Date(post.createdAt).toLocaleDateString()}</span><span>🏷️ ${escapeHtml(post.category || '未分类')}</span><span>👁️ ${views}阅读</span>${post.tags && post.tags.length ? `<span>${post.tags.map(t => '#' + escapeHtml(t)).join(' ')}</span>` : ''}</div><p style="color:#718096;line-height:1.5">${escapeHtml(excerptText)}...</p></div>${coverImgHtml}</div></div>`;
    }).join('');
    
    const hotPosts = [...posts.filter(p => p.status === 'published')].sort((a, b) => (viewsMap.get(b.id) || 0) - (viewsMap.get(a.id) || 0)).slice(0, 5);
    const hotPostsHtml = hotPosts.map(p => `<a href="/post/${p.id}" style="display:block;padding:10px 12px;margin:4px 0;border-radius:8px;text-decoration:none;color:#4a5568;font-size:13px;background:#f8fafc">🔥 ${escapeHtml(p.title.length > 20 ? p.title.substring(0,20)+'...' : p.title)} <span style="float:right;color:#a0aec0">${viewsMap.get(p.id) || 0}阅</span></a>`).join('');
    
    const siteTitle = await kv.get('site_title') || '旭儿导航';
    const siteSubtitle = await kv.get('site_subtitle') || '精选网站 · 优质博客';
    const logo = await kv.get('site_logo') || '';
    const logoLink = await kv.get('site_logo_link') || '';
    const headerBg = await kv.get('header_bg') || '';
    const cnLink = await kv.get('cn_link') || '';
    
    let logoHtml = '';
    if (logo) {
        if (logoLink) {
            logoHtml = `<a href="${escapeHtml(logoLink)}" target="_blank"><img src="${escapeHtml(logo)}" style="max-width:200px;max-height:240px"></a>`;
        } else {
            logoHtml = `<img src="${escapeHtml(logo)}" style="max-width:200px;max-height:240px">`;
        }
    } else {
        logoHtml = `<div style="font-size:28px;font-weight:bold;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(siteTitle)}</div>`;
    }
    
    const titleText = currentTab === 'blog' ? (searchQuery ? `搜索: ${escapeHtml(searchQuery)}` : '博客文章') : (currentCat ? `${escapeHtml(currentCat)} · ${filteredSites.length}个网站` : `全部收藏 · ${sites.length}个网站`);
    
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes"><title>${escapeHtml(siteTitle)} · ${currentTab === 'blog' ? '博客' : '书签'}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f7fafc}.sidebar{position:fixed;left:0;top:0;width:280px;height:100vh;background:#fff;box-shadow:2px 0 12px rgba(0,0,0,.05);overflow-y:auto;z-index:100;transition:transform .3s ease-in-out}.sidebar-header{padding:20px;text-align:center;border-bottom:1px solid #e2e8f0}.sidebar-nav{padding:20px}.main{margin-left:280px;min-height:100vh}.header{position:relative;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:50px 40px;text-align:left;overflow:hidden}.header-bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}.header-content{position:relative;z-index:2}.header h1{font-size:42px;margin-bottom:12px;display:inline-block;margin-right:20px}.cn-btn{display:inline-block;background:rgba(255,255,255,.2);color:#fff;padding:8px 20px;border-radius:30px;text-decoration:none;font-size:16px;vertical-align:middle}.cn-btn:hover{background:rgba(255,255,255,.3)}.content{max-width:1300px;margin:0 auto;padding:35px 30px}.content-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;flex-wrap:wrap;gap:12px}.content-header h2{font-size:22px;color:#2d3748}.tab-buttons{display:flex;gap:10px}.tab-btn{padding:8px 20px;border:none;border-radius:30px;cursor:pointer;font-size:14px;transition:all .2s;-webkit-tap-highlight-color:transparent}.tab-btn.active{background:#667eea;color:#fff}.tab-btn:not(.active){background:#e2e8f0}.sites-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:24px}.site-card,.blog-card{background:#fff;border-radius:12px;padding:16px;margin-bottom:20px;cursor:pointer;transition:transform .2s,box-shadow .2s}.site-card:hover,.blog-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.1)}.search-box{margin-bottom:20px}.search-box input{width:100%;padding:12px 16px;border:1px solid #ddd;border-radius:30px;font-size:16px}.tag-cloud{margin-bottom:20px;padding:15px;background:#f8fafc;border-radius:12px}.mobile-toggle{display:none;position:fixed;top:15px;left:15px;z-index:101;background:#667eea;color:#fff;border:none;width:44px;height:44px;border-radius:12px;cursor:pointer;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,.15);-webkit-tap-highlight-color:transparent}.dark-mode-toggle{position:fixed;bottom:20px;right:20px;background:#667eea;color:#fff;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:1000;font-size:20px;box-shadow:0 2px 10px rgba(0,0,0,.2);-webkit-tap-highlight-color:transparent}.go-top{position:fixed;bottom:20px;left:20px;background:#667eea;color:#fff;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:1000;display:none;font-size:20px;box-shadow:0 2px 10px rgba(0,0,0,.2);-webkit-tap-highlight-color:transparent}body.dark{background:#1a1a2e}body.dark .sidebar{background:#16213e;color:#eee}body.dark .site-card,body.dark .blog-card{background:#16213e;color:#eee}body.dark .content-header h2{color:#eee}body.dark .tag-cloud{background:#0f3460}@media (max-width:768px){.sidebar{transform:translateX(-100%);width:260px}.sidebar.open{transform:translateX(0)}.main{margin-left:0}.mobile-toggle{display:flex;align-items:center;justify-content:center}.header{padding:30px 20px}.header h1{font-size:28px}.cn-btn{font-size:12px;padding:4px 12px}.content{padding:20px 16px}.content-header h2{font-size:18px}.tab-btn{padding:6px 14px;font-size:13px}.sites-grid{grid-template-columns:1fr;gap:16px}.site-card,.blog-card{padding:14px;margin-bottom:16px}.blog-card h3{font-size:16px}.dark-mode-toggle,.go-top{width:44px;height:44px;font-size:18px;bottom:15px}.dark-mode-toggle{right:15px}.go-top{left:15px}}@media (hover:none) and (pointer:coarse){.tab-btn,.copy-btn,.site-card,.blog-card,.dark-mode-toggle,.go-top,.mobile-toggle{cursor:default;-webkit-tap-highlight-color:rgba(102,126,234,0.2)}.copy-btn{padding:8px 16px;min-width:60px}}</style></head>
<body><button class="mobile-toggle" id="mobileToggle">☰</button><div class="sidebar" id="sidebar"><div class="sidebar-header">${logoHtml}</div><div class="sidebar-nav"><a href="/?tab=blog" style="display:block;padding:12px;background:#e2e8f0;border-radius:8px;text-align:center;margin-bottom:15px;text-decoration:none;color:#667eea;font-weight:600">📝 博客列表</a><div style="font-weight:600;margin:15px 0 10px">📁 书签分类</div>${catNavHtml || '<div>暂无分类</div>'}<div style="font-weight:600;margin:20px 0 10px">🔥 热门文章</div>${hotPostsHtml || '<div>暂无</div>'}<div style="margin-top:20px;padding-top:15px;border-top:1px solid #e2e8f0"><a href="/admin" style="display:block;padding:12px;background:#edf2f7;border-radius:8px;text-align:center;text-decoration:none">⚙️ 后台管理</a></div></div></div><div class="main"><div class="header">${headerBg ? `<img class="header-bg-img" src="${escapeHtml(headerBg)}">` : ''}<div class="header-content"><h1>${escapeHtml(siteTitle)}</h1>${cnLink ? `<a href="${escapeHtml(cnLink)}" class="cn-btn" target="_blank">🇨🇳 国内线路</a>` : ''}<p>${escapeHtml(siteSubtitle)}</p><div>📅 ${new Date().toLocaleDateString('zh-CN')}</div></div></div><div class="content"><div class="content-header"><h2>${titleText}</h2><div class="tab-buttons"><button class="tab-btn ${currentTab === 'blog' ? 'active' : ''}" data-tab="blog">📝 博客</button><button class="tab-btn ${currentTab === 'bookmark' ? 'active' : ''}" data-tab="bookmark">🔖 书签</button></div></div><div id="blog-view" style="display:${currentTab === 'blog' ? 'block' : 'none'}"><div class="search-box"><form id="searchForm" onsubmit="event.preventDefault();let u=new URL(location.href);u.searchParams.set('q',this.q.value);location.href=u"><input type="text" name="q" placeholder="🔍 搜索文章..." value="${escapeHtml(searchQuery)}"></form></div>${tagCloudHtml ? `<div class="tag-cloud"><strong>🏷️ 热门标签：</strong> ${tagCloudHtml}</div>` : ''}${blogListHtml || '<div style="text-align:center;padding:60px">暂无文章</div>'}</div><div id="bookmark-view" style="display:${currentTab === 'bookmark' ? 'block' : 'none'}"><div class="sites-grid">${cardsHtml || '<div style="text-align:center;padding:60px">暂无书签</div>'}</div></div></div></div><button class="dark-mode-toggle" id="darkModeToggle">🌙</button><button class="go-top" id="goTop">↑</button><script>document.getElementById('mobileToggle').onclick=()=>{document.getElementById('sidebar').classList.toggle('open');};document.querySelectorAll('.copy-btn').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();navigator.clipboard.writeText(btn.dataset.url);btn.textContent='✓';setTimeout(()=>btn.textContent='复制',1000)});document.querySelectorAll('.tab-btn').forEach(btn=>btn.onclick=()=>{let u=new URL(location.href);u.searchParams.set('tab',btn.dataset.tab);u.searchParams.delete('c');u.searchParams.delete('q');u.searchParams.delete('tag');location.href=u});const darkToggle=document.getElementById('darkModeToggle');if(localStorage.getItem('darkMode')==='true')document.body.classList.add('dark');darkToggle.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('darkMode',document.body.classList.contains('dark'));darkToggle.textContent=document.body.classList.contains('dark')?'☀️':'🌙'};const goTop=document.getElementById('goTop');window.onscroll=()=>goTop.style.display=window.scrollY>300?'block':'none';goTop.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.getElementById('sidebar').addEventListener('click',(e)=>{if(window.innerWidth<=768&&e.target.closest('a')){document.getElementById('sidebar').classList.remove('open');}});</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== 文章详情页 ====================
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
    
    let safeContent = post.content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    safeContent = safeContent.replace(/<img/g, '<img style="max-width:100%;height:auto;display:block;margin:20px auto;border-radius:8px"');
    
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(post.title)} - 旭儿导航</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;padding:20px}.container{max-width:900px;margin:0 auto}.article{background:#fff;border-radius:20px;padding:40px}h1{font-size:28px;margin-bottom:16px}.meta{color:#888;font-size:14px;margin-bottom:30px;padding-bottom:16px;border-bottom:1px solid #eee}.tags{margin-top:8px}.tag{display:inline-block;background:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:12px;margin-right:8px}.content{line-height:1.8;font-size:16px}.content p{margin-bottom:16px}.content img{max-width:100%;height:auto;display:block;margin:20px auto;border-radius:8px}.back-btn{display:inline-block;margin-top:30px;background:#667eea;color:#fff;padding:10px 24px;border-radius:30px;text-decoration:none}@media (max-width:768px){.article{padding:20px}h1{font-size:22px}.content{font-size:14px}}</style></head><body><div class="container"><div class="article"><h1>${escapeHtml(post.title)}</h1><div class="meta">${post.category ? `分类：${escapeHtml(post.category)} · ` : ''}发布时间：${new Date(post.createdAt).toLocaleDateString()} · 阅读：${views}次${post.tags && post.tags.length ? `<div class="tags">${post.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}</div><div class="content">${safeContent}</div><a href="/" class="back-btn">← 返回首页</a></div></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== 后台管理 ====================
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
        return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>管理员登录</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.box{background:#fff;padding:40px;border-radius:24px;width:100%;max-width:340px;text-align:center;box-shadow:0 20px 35px -8px rgba(0,0,0,0.2)}.box h2{color:#1a202c;margin-bottom:24px}.input-group{margin-bottom:16px;text-align:left}.input-group label{display:block;margin-bottom:6px;color:#4a5568;font-size:14px;font-weight:500}.box input{width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:12px;font-size:16px;transition:all .2s}.box input:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}.box button{width:100%;padding:12px;background:#667eea;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;margin-top:8px}.box button:hover{background:#5a67d8}</style></head><body><div class="box"><h2>✨ 管理员登录</h2><form method="post"><div class="input-group"><label>密码</label><input type="password" name="password" placeholder="请输入密码" required></div><button type="submit">登录后台</button></form></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    
    let sites = [], posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }
    
    sites.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999));
    posts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.id - a.id;
    });
    
    const siteTitle = await kv.get('site_title') || '';
    const siteSubtitle = await kv.get('site_subtitle') || '';
    const siteLogo = await kv.get('site_logo') || '';
    const siteLogoLink = await kv.get('site_logo_link') || '';
    const headerBg = await kv.get('header_bg') || '';
    const cnLink = await kv.get('cn_link') || '';
    
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes"><title>管理后台 · 旭儿导航</title>
<link href="https://cdn.staticfile.org/quill/1.3.6/quill.snow.css" rel="stylesheet">
<script src="https://cdn.staticfile.org/quill/1.3.6/quill.js"></script>
<style>
:root {
    --primary: #667eea;
    --primary-dark: #5a67d8;
    --success: #38a169;
    --danger: #e53e3e;
    --warning: #ed8936;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-600: #475569;
    --gray-800: #1e293b;
    --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;padding:20px}
.container{max-width:1400px;margin:0 auto}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 24px;border-radius:var(--radius-lg);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:24px;box-shadow:var(--shadow-md)}
.header h1{font-size:20px;font-weight:600;display:flex;align-items:center;gap:8px}
.header h1:before{content:"⚡"}
.card{background:white;border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;box-shadow:var(--shadow-sm);border:1px solid var(--gray-200)}
.card:hover{box-shadow:var(--shadow-md)}
.card-title{font-size:18px;font-weight:600;color:var(--gray-800);padding-bottom:16px;margin-bottom:20px;border-bottom:2px solid var(--gray-100);display:flex;align-items:center;gap:8px}
.form-group{margin-bottom:16px}
.form-group label{display:block;margin-bottom:6px;font-weight:500;color:var(--gray-600);font-size:13px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:14px;transition:all .2s;background:white}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
.form-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.form-row input{width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:14px}
.form-row input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
.btn{padding:8px 16px;border-radius:var(--radius-sm);font-weight:500;font-size:13px;border:none;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn:active{transform:scale(0.97)}
.btn-primary{background:var(--primary);color:white}
.btn-primary:hover{background:var(--primary-dark)}
.btn-success{background:var(--success);color:white}
.btn-success:hover{background:#2f855a}
.btn-danger{background:var(--danger);color:white}
.btn-danger:hover{background:#c53030}
.btn-warning{background:var(--warning);color:white}
.btn-warning:hover{background:#dd6b20}
.btn-secondary{background:var(--gray-200);color:var(--gray-600)}
.btn-secondary:hover{background:var(--gray-300)}
.btn-sm{padding:6px 12px;font-size:12px}
.table-wrapper{overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--gray-200)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--gray-200)}
th{background:var(--gray-50);font-weight:600;color:var(--gray-600)}
tr:last-child td{border-bottom:none}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.badge{padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
.badge-published{background:#d4edda;color:#155724}
.badge-draft{background:#fff3cd;color:#856404}
.badge-pin{background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;justify-content:center;align-items:center;padding:20px}
.modal-content{background:white;border-radius:var(--radius-lg);padding:24px;width:100%;max-width:750px;max-height:90vh;overflow-y:auto}
.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--gray-100)}
.modal-header h3{font-size:20px;font-weight:600;color:var(--gray-800)}
.close-modal{font-size:28px;cursor:pointer;color:var(--gray-600);transition:color .2s}
.close-modal:hover{color:var(--danger)}
.ql-editor{min-height:250px}
.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;margin-top:16px}
.image-card{position:relative;border:1px solid var(--gray-200);border-radius:var(--radius-sm);padding:8px;text-align:center;background:var(--gray-50)}
.image-card img{width:100%;height:80px;object-fit:cover;border-radius:6px;cursor:pointer}
.image-card .img-delete{position:absolute;top:-8px;right:-8px;background:var(--danger);color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px}
.image-card .img-copy{position:absolute;bottom:4px;right:4px;background:var(--primary);color:white;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer}
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media (max-width:768px){body{padding:12px}.header{padding:12px 16px}.header h1{font-size:16px}.card{padding:16px}.card-title{font-size:16px}.form-row{grid-template-columns:1fr;gap:12px}.settings-grid{grid-template-columns:1fr;gap:16px}th,td{padding:10px 12px;font-size:13px}.btn-sm{padding:5px 10px;font-size:11px}}
</style></head>
<body><div class="container">
<div class="header"><h1>旭儿导航 · 管理后台</h1><div style="display:flex;gap:10px"><button id="changePwdBtn" class="btn btn-warning btn-sm">🔑 修改密码</button><button id="manageImagesBtn" class="btn btn-primary btn-sm">🖼️ 图片管理</button><a href="/logout" style="background:rgba(255,255,255,0.2);color:white;padding:6px 14px;border-radius:8px;text-decoration:none;font-size:13px">退出</a></div></div>

<!-- 1. 文章管理（表单在上，列表在下） -->
<div class="card"><div class="card-title"><span>📝</span> 文章管理</div>
<div style="margin-bottom:20px"><button id="newPostBtn" class="btn btn-success">✏️ 写新文章</button></div>
<div class="table-wrapper"><table><thead><tr><th>ID</th><th>标题</th><th>分类</th><th>状态</th><th>日期</th><th>操作</th></tr></thead><tbody id="postsList"></tbody></table></div>
</div>

<!-- 2. 书签管理（表单在上，列表在下） -->
<div class="card"><div class="card-title"><span>🔖</span> 书签管理</div>
<div class="form-row">
    <input type="text" id="siteName" placeholder="网站名称">
    <input type="url" id="siteUrl" placeholder="网址">
    <input type="text" id="siteCat" placeholder="分类">
    <input type="number" id="siteSort" placeholder="排序" value="9999">
</div>
<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <input type="url" id="siteLogo" placeholder="Logo URL" style="flex:1;padding:10px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:14px">
    <button id="selectSiteLogoBtn" class="btn btn-secondary btn-sm">🖼️ 从图库选择</button>
</div>
<textarea id="siteDesc" rows="2" placeholder="描述" style="width:100%;margin-bottom:16px;padding:10px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:14px;font-family:inherit"></textarea>
<button id="addSiteBtn" class="btn btn-primary">➕ 添加书签</button>
<div class="table-wrapper" style="margin-top:20px"><table><thead><tr><th>ID</th><th>名称</th><th>网址</th><th>分类</th><th>排序</th><th>操作</th></tr></thead><tbody id="sitesList"></tbody></table></div>
</div>

<!-- 3. 站点设置（放在最底部） -->
<div class="card"><div class="card-title"><span>⚙️</span> 站点设置</div>
<div class="settings-grid">
    <div><label style="font-size:13px;font-weight:500;color:var(--gray-600);margin-bottom:4px;display:block">站点标题</label><input type="text" id="siteTitle" value="${escapeHtml(siteTitle)}" style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px"></div>
    <div><label style="font-size:13px;font-weight:500;color:var(--gray-600);margin-bottom:4px;display:block">站点副标题</label><input type="text" id="siteSubtitle" value="${escapeHtml(siteSubtitle)}" style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px"></div>
    <div><label style="font-size:13px;font-weight:500;color:var(--gray-600);margin-bottom:4px;display:block">Logo URL</label><input type="url" id="logoUrl" value="${escapeHtml(siteLogo)}" style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;margin-bottom:6px;font-size:14px"><button id="selectLogoBtn" class="btn btn-secondary btn-sm" style="width:100%">从图库选择</button></div>
    <div><label style="font-size:13px;font-weight:500;color:var(--gray-600);margin-bottom:4px;display:block">Logo 跳转链接</label><input type="url" id="logoLink" value="${escapeHtml(siteLogoLink)}" style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px"></div>
    <div><label style="font-size:13px;font-weight:500;color:var(--gray-600);margin-bottom:4px;display:block">页眉背景图</label><input type="url" id="headerBgUrl" value="${escapeHtml(headerBg)}" style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;margin-bottom:6px;font-size:14px"><button id="selectHeaderBgBtn" class="btn btn-secondary btn-sm" style="width:100%">从图库选择</button></div>
    <div><label style="font-size:13px;font-weight:500;color:var(--gray-600);margin-bottom:4px;display:block">国内线路链接</label><input type="url" id="cnLink" value="${escapeHtml(cnLink)}" style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px"></div>
</div>
<div style="margin-top:20px"><button id="saveSettingsBtn" class="btn btn-primary">💾 保存设置</button><span id="settingsStatus" style="margin-left:16px;font-size:13px;color:var(--success)"></span></div>
</div></div>

<!-- 文章编辑模态框 -->
<div id="postModal" class="modal"><div class="modal-content"><div class="modal-header"><h3 id="modalTitle">写新文章</h3><span class="close-modal close-post-modal">&times;</span></div><input type="hidden" id="postId"><div class="form-group"><label>标题</label><input type="text" id="postTitle" placeholder="文章标题"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px"><div><label>分类</label><input type="text" id="postCategory" placeholder="分类"></div><div><label>状态</label><select id="postStatus"><option value="published">发布</option><option value="draft">草稿</option></select></div></div><div class="form-group"><label>封面图（首页列表显示）</label><input type="url" id="postCoverImage" style="margin-bottom:8px;padding:10px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:14px;width:100%"><button id="selectCoverFromImagesBtn" class="btn btn-secondary btn-sm" style="width:100%">🖼️ 从图库选择</button></div><div class="form-group"><label>摘要</label><textarea id="postExcerpt" rows="2" placeholder="简短摘要..."></textarea></div><div class="form-group"><label>内容</label><div id="quill-editor"></div><textarea id="postContent" style="display:none"></textarea></div><div class="form-group"><label>标签</label><input type="text" id="postTags" placeholder="技术,生活"></div><div class="form-group"><label><input type="checkbox" id="postPinned"> 📌 置顶文章</label></div><div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px"><button id="cancelPostBtn" class="btn btn-secondary">取消</button><button id="savePostBtn" class="btn btn-success">发布</button></div></div></div>

<!-- 修改密码模态框 -->
<div id="changePwdModal" class="modal"><div class="modal-content" style="max-width:400px"><div class="modal-header"><h3>🔑 修改密码</h3><span class="close-modal close-pwd-modal">&times;</span></div><div class="form-group"><label>原密码</label><input type="password" id="oldPassword"></div><div class="form-group"><label>新密码</label><input type="password" id="newPassword"></div><div class="form-group"><label>确认新密码</label><input type="password" id="confirmPassword"></div><div style="display:flex;justify-content:flex-end;gap:12px"><button id="cancelPwdBtn" class="btn btn-secondary">取消</button><button id="confirmPwdBtn" class="btn btn-primary">确认修改</button></div></div></div>

<!-- 图片管理模态框 -->
<div id="imagesModal" class="modal"><div class="modal-content" style="max-width:700px"><div class="modal-header"><h3>🖼️ 图片管理</h3><span class="close-modal close-images-modal">&times;</span></div><div style="margin-bottom:16px"><button id="uploadNewImageBtn" class="btn btn-success" style="width:100%">📤 上传新图片</button></div><div id="imageListContainer" class="image-grid"><div style="text-align:center;padding:40px;color:#999">加载中...</div></div><div style="margin-top:12px;text-align:center;color:#718096;font-size:12px">点击图片选择，点击✕删除，点击复制获取URL</div></div></div>

<input type="file" id="imageUploadInput" accept="image/*" style="display:none">

<script>
let allPosts = ${JSON.stringify(posts)};
let allSites = ${JSON.stringify(sites)};
let quill = null;
let currentSelectTarget = null;
let editPostId = null;
let editSiteId = null;

function escape(str){if(!str)return '';return String(str).replace(/[&<>]/g,function(m){if(m==='&')return'&amp;';if(m==='<')return'&lt;';if(m==='>')return'&gt;';return m;});}
function initQuill(){if(quill)return;quill=new Quill('#quill-editor',{theme:'snow',placeholder:'写下你的文章内容...',modules:{toolbar:[['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link','image'],['clean']]}});quill.on('text-change',()=>{document.getElementById('postContent').value=quill.root.innerHTML;});}
function renderPosts(){let sorted=[...allPosts];sorted.sort((a,b)=>{if(a.pinned&&!b.pinned)return-1;if(!a.pinned&&b.pinned)return1;return b.id-a.id;});let html='';for(let p of sorted){html+='<tr><td>'+p.id+'</td><td><strong>'+escape(p.title)+'</strong>'+(p.pinned?'<span class="badge-pin">置顶</span>':'')+'</td><td>'+escape(p.category||'未分类')+'</td><td><span class="badge '+(p.status==='published'?'badge-published':'badge-draft')+'">'+(p.status==='published'?'已发布':'草稿')+'</span></td><td>'+new Date(p.createdAt).toLocaleDateString()+'</td><td class="actions"><button class="btn btn-warning btn-sm" onclick="editPost('+p.id+')">编辑</button><button class="btn btn-danger btn-sm" onclick="deletePost('+p.id+')">删除</button></td></tr>';}document.getElementById('postsList').innerHTML=html;}
function renderSites(){let html='';for(let s of allSites){html+='<tr><td>'+s.id+'</td><td><strong>'+escape(s.name)+'</strong></td><td><a href="'+escape(s.url)+'" target="_blank" style="color:#667eea">'+escape(s.url).substring(0,40)+'</a></td><td>'+escape(s.catelog)+'</td><td>'+(s.sort_order||9999)+'</td><td class="actions"><button class="btn btn-warning btn-sm" onclick="editSite('+s.id+')">编辑</button><button class="btn btn-danger btn-sm" onclick="deleteSite('+s.id+')">删除</button></td></tr>';}document.getElementById('sitesList').innerHTML=html;}
function editPost(id){let p=allPosts.find(p=>p.id==id);if(p){editPostId=id;initQuill();document.getElementById('postId').value=p.id;document.getElementById('postTitle').value=p.title;document.getElementById('postCategory').value=p.category||'';document.getElementById('postCoverImage').value=p.coverImage||'';document.getElementById('postExcerpt').value=p.excerpt||'';document.getElementById('postStatus').value=p.status||'published';document.getElementById('postTags').value=(p.tags||[]).join(',');document.getElementById('postPinned').checked=p.pinned||false;quill.root.innerHTML=p.content||'';document.getElementById('modalTitle').innerText='编辑文章';document.getElementById('savePostBtn').innerText='更新';document.getElementById('postModal').style.display='flex';}}
function editSite(id){let s=allSites.find(s=>s.id==id);if(s){editSiteId=id;document.getElementById('siteName').value=s.name;document.getElementById('siteUrl').value=s.url;document.getElementById('siteCat').value=s.catelog;document.getElementById('siteSort').value=s.sort_order||9999;document.getElementById('siteLogo').value=s.logo||'';document.getElementById('siteDesc').value=s.desc||'';document.getElementById('addSiteBtn').innerHTML='✏️ 更新书签';}}
function clearSiteForm(){editSiteId=null;document.getElementById('siteName').value='';document.getElementById('siteUrl').value='';document.getElementById('siteCat').value='';document.getElementById('siteSort').value='9999';document.getElementById('siteLogo').value='';document.getElementById('siteDesc').value='';document.getElementById('addSiteBtn').innerHTML='➕ 添加书签';}
function closePostModal(){document.getElementById('postModal').style.display='none';editPostId=null;document.getElementById('savePostBtn').innerText='发布';document.getElementById('modalTitle').innerText='写新文章';}
async function savePost(){if(quill)document.getElementById('postContent').value=quill.root.innerHTML;let data={title:document.getElementById('postTitle').value.trim(),category:document.getElementById('postCategory').value.trim(),coverImage:document.getElementById('postCoverImage').value.trim(),excerpt:document.getElementById('postExcerpt').value.trim(),content:document.getElementById('postContent').value,status:document.getElementById('postStatus').value,tags:document.getElementById('postTags').value.split(',').map(t=>t.trim()).filter(t=>t),pinned:document.getElementById('postPinned').checked};if(!data.title||!data.content||data.content==='<p><br></p>'){alert('请填写标题和内容');return;}let url=editPostId?'/api/blog/'+editPostId:'/api/blog';let method=editPostId?'PUT':'POST';let r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});let d=await r.json();if(d.code===200||d.code===201){alert(editPostId?'更新成功':'发布成功');closePostModal();location.reload();}else alert('操作失败');}
async function deletePost(id){if(!confirm('确定删除？'))return;let r=await fetch('/api/blog/'+id,{method:'DELETE'});if(r.ok){alert('删除成功');location.reload();}else alert('删除失败');}
async function addOrUpdateSite(){let name=document.getElementById('siteName').value.trim();let url=document.getElementById('siteUrl').value.trim();let catelog=document.getElementById('siteCat').value.trim();let logo=document.getElementById('siteLogo').value.trim();let desc=document.getElementById('siteDesc').value.trim();let sort_order=parseInt(document.getElementById('siteSort').value)||9999;if(!name||!url||!catelog){alert('请填写完整');return;}if(editSiteId){let r=await fetch('/api/config/'+editSiteId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,url,catelog,logo,desc,sort_order})});if(r.ok){alert('更新成功');location.reload();}else alert('更新失败');}else{let r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,url,catelog,logo,desc,sort_order})});if(r.ok)location.reload();else alert('添加失败');}}
async function deleteSite(id){if(!confirm('确定删除？'))return;let r=await fetch('/api/config/'+id,{method:'DELETE'});if(r.ok){alert('删除成功');location.reload();}else alert('删除失败');}
async function saveSettings(){let data={title:document.getElementById('siteTitle').value,subtitle:document.getElementById('siteSubtitle').value,logo:document.getElementById('logoUrl').value,logoLink:document.getElementById('logoLink').value,headerBg:document.getElementById('headerBgUrl').value,cnLink:document.getElementById('cnLink').value};let r=await fetch('/api/site-info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(r.ok){document.getElementById('settingsStatus').innerText='保存成功';setTimeout(()=>document.getElementById('settingsStatus').innerText='',2000);}else alert('保存失败');}
async function changePassword(){let oldPwd=document.getElementById('oldPassword').value;let newPwd=document.getElementById('newPassword').value;let confirmPwd=document.getElementById('confirmPassword').value;if(newPwd!==confirmPwd){alert('密码不一致');return;}if(newPwd.length<4){alert('密码至少4位');return;}let r=await fetch('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({old_password:oldPwd,new_password:newPwd})});let d=await r.json();if(d.code===200){alert('修改成功，请重新登录');window.location.href='/logout';}else alert(d.message);}
async function loadImages(){let r=await fetch('/api/images');let d=await r.json();if(d.code===200&&d.images){let html='';for(let img of d.images){html+='<div class="image-card"><img src="'+img.url+'" data-url="'+img.url+'"><div class="img-delete" data-key="'+img.key+'">✕</div><div class="img-copy" data-url="'+img.url+'">复制</div></div>';}document.getElementById('imageListContainer').innerHTML=html||'<div style="text-align:center;padding:40px">暂无图片</div>';document.querySelectorAll('.image-card img').forEach(img=>{img.onclick=()=>{if(currentSelectTarget){document.getElementById(currentSelectTarget).value=img.dataset.url;document.getElementById('imagesModal').style.display='none';currentSelectTarget=null;alert('已选择');}else{copyImageUrl(img.dataset.url);}}});document.querySelectorAll('.img-copy').forEach(btn=>{btn.onclick=(e)=>{e.stopPropagation();copyImageUrl(btn.dataset.url);}});document.querySelectorAll('.img-delete').forEach(btn=>{btn.onclick=(e)=>{e.stopPropagation();deleteImage(btn.dataset.key,btn);}});}else{document.getElementById('imageListContainer').innerHTML='<div style="text-align:center;padding:40px">加载失败</div>';}}
async function copyImageUrl(url){await navigator.clipboard.writeText(url);alert('已复制');}
async function deleteImage(key,btnEl){if(!confirm('确定删除？'))return;let r=await fetch('/api/images/'+key,{method:'DELETE'});if(r.ok){btnEl.closest('.image-card').remove();alert('删除成功');}else alert('删除失败');}
async function uploadNewImage(){let input=document.getElementById('imageUploadInput');input.onchange=async(e)=>{let file=e.target.files[0];if(!file)return;let fd=new FormData();fd.append('image',file);let r=await fetch('/api/upload',{method:'POST',body:fd});let d=await r.json();if(d.code===200){alert('上传成功');loadImages();}else alert('上传失败');input.value='';};input.click();}
function openImagesModal(targetId){currentSelectTarget=targetId||null;document.getElementById('imagesModal').style.display='flex';loadImages();}
document.getElementById('newPostBtn').onclick=()=>{editPostId=null;clearSiteForm();initQuill();document.getElementById('postId').value='';document.getElementById('postTitle').value='';document.getElementById('postCategory').value='';document.getElementById('postCoverImage').value='';document.getElementById('postExcerpt').value='';document.getElementById('postStatus').value='published';document.getElementById('postTags').value='';document.getElementById('postPinned').checked=false;quill.root.innerHTML='';document.getElementById('modalTitle').innerText='写新文章';document.getElementById('savePostBtn').innerText='发布';document.getElementById('postModal').style.display='flex';};
document.getElementById('cancelPostBtn').onclick=closePostModal;
document.querySelector('.close-post-modal').onclick=closePostModal;
document.getElementById('savePostBtn').onclick=savePost;
document.getElementById('saveSettingsBtn').onclick=saveSettings;
document.getElementById('selectLogoBtn').onclick=()=>openImagesModal('logoUrl');
document.getElementById('selectHeaderBgBtn').onclick=()=>openImagesModal('headerBgUrl');
document.getElementById('selectCoverFromImagesBtn').onclick=()=>openImagesModal('postCoverImage');
document.getElementById('selectSiteLogoBtn').onclick=()=>openImagesModal('siteLogo');
document.getElementById('addSiteBtn').onclick=addOrUpdateSite;
document.getElementById('changePwdBtn').onclick=()=>document.getElementById('changePwdModal').style.display='flex';
document.querySelector('.close-pwd-modal').onclick=()=>document.getElementById('changePwdModal').style.display='none';
document.getElementById('cancelPwdBtn').onclick=()=>document.getElementById('changePwdModal').style.display='none';
document.getElementById('confirmPwdBtn').onclick=changePassword;
document.getElementById('manageImagesBtn').onclick=()=>openImagesModal(null);
document.querySelector('.close-images-modal').onclick=()=>document.getElementById('imagesModal').style.display='none';
document.getElementById('uploadNewImageBtn').onclick=uploadNewImage;
window.onclick=(e)=>{if(e.target.classList.contains('modal')){document.getElementById('postModal').style.display='none';document.getElementById('changePwdModal').style.display='none';document.getElementById('imagesModal').style.display='none';}};
renderPosts();renderSites();
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== API ====================
async function handleApi(request, kv) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === 'GET' && path === '/api/config') {
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        sites.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999));
        return new Response(JSON.stringify({ code: 200, data: sites }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/config') {
        const body = await request.json();
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        const newId = sites.length ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        sites.push({ id: newId, name: body.name, url: body.url, catelog: body.catelog, logo: body.logo || '', desc: body.desc || '', sort_order: body.sort_order || 9999 });
        sites.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999));
        await kv.put('sites', JSON.stringify(sites));
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'PUT' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        const body = await request.json();
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        const idx = sites.findIndex(s => s.id === id);
        if (idx !== -1) {
            sites[idx] = { ...sites[idx], name: body.name, url: body.url, catelog: body.catelog, logo: body.logo || '', desc: body.desc || '', sort_order: body.sort_order || 9999 };
            sites.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999));
            await kv.put('sites', JSON.stringify(sites));
        }
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        let sites = [];
        try { const data = await kv.get('sites'); if (data) sites = JSON.parse(data); } catch(e) { }
        const deletedSite = sites.find(s => s.id === id);
        if (deletedSite && deletedSite.logo && deletedSite.logo.startsWith('/api/image/')) {
            const imageKey = deletedSite.logo.split('/').pop();
            await kv.delete(`img:${imageKey}`).catch(e=>console.error('Failed to delete image:', e));
        }
        await kv.put('sites', JSON.stringify(sites.filter(s => s.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'GET' && path === '/api/blog') {
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        posts.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.id - a.id;
        });
        return new Response(JSON.stringify({ code: 200, data: posts }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/blog') {
        const body = await request.json();
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        const baseSlug = (body.title || 'post').replace(/[^\w\u4e00-\u9fa5]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'post';
        let slug = baseSlug;
        let suffix = 1;
        let maxIter = 100;
        while (posts.some(p => p.slug === slug) && maxIter-- > 0) { slug = baseSlug + '-' + (suffix++); }
        const plainContent = (body.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const excerpt = (body.excerpt && body.excerpt.trim()) ? body.excerpt.trim() : plainContent.substring(0, 150);
        const newPost = { 
            id: Date.now(), slug: slug, title: body.title || '无标题', content: body.content || '',
            category: body.category || '未分类', coverImage: body.coverImage || '', excerpt: excerpt,
            status: body.status || 'published', tags: Array.isArray(body.tags) ? body.tags : [],
            pinned: body.pinned === true || body.pinned === 'true',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
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
            posts[idx] = { ...posts[idx], ...body, updatedAt: new Date().toISOString() };
            await kv.put('blog_posts', JSON.stringify(posts));
        }
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        const deletedPost = posts.find(p => p.id === id);
        if (deletedPost && deletedPost.coverImage && deletedPost.coverImage.startsWith('/api/image/')) {
            const imageKey = deletedPost.coverImage.split('/').pop();
            await kv.delete(`img:${imageKey}`).catch(e=>console.error('Failed to delete image:', e));
        }
        await kv.delete(`views:${id}`).catch(e=>console.error('Failed to delete views:', e));
        await kv.put('blog_posts', JSON.stringify(posts.filter(p => p.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'GET' && path === '/api/site-info') {
        const title = await kv.get('site_title') || '';
        const subtitle = await kv.get('site_subtitle') || '';
        const logo = await kv.get('site_logo') || '';
        const logoLink = await kv.get('site_logo_link') || '';
        const headerBg = await kv.get('header_bg') || '';
        const cnLink = await kv.get('cn_link') || '';
        return new Response(JSON.stringify({ title, subtitle, logo, logoLink, headerBg, cnLink }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/site-info') {
        const body = await request.json();
        if (body.title !== undefined) await kv.put('site_title', body.title);
        if (body.subtitle !== undefined) await kv.put('site_subtitle', body.subtitle);
        if (body.logo !== undefined) await kv.put('site_logo', body.logo);
        if (body.logoLink !== undefined) await kv.put('site_logo_link', body.logoLink);
        if (body.headerBg !== undefined) await kv.put('header_bg', body.headerBg);
        if (body.cnLink !== undefined) await kv.put('cn_link', body.cnLink);
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/change-password') {
        const body = await request.json();
        const adminPass = await kv.get('admin_password') || 'admin123';
        if (body.old_password !== adminPass) {
            return new Response(JSON.stringify({ code: 401, message: '原密码错误' }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (body.new_password.length < 4) {
            return new Response(JSON.stringify({ code: 400, message: '新密码长度至少4位' }), { headers: { 'Content-Type': 'application/json' } });
        }
        await kv.put('admin_password', body.new_password);
        return new Response(JSON.stringify({ code: 200, message: '修改成功' }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ code: 404 }), { status: 404 });
}

// ==================== 上传 ====================
async function handleUpload(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    let isLoggedIn = false;
    if (match) {
        const session = await kv.get(`session:${match[1]}`);
        isLoggedIn = session !== null;
    }
    if (!isLoggedIn) return new Response(JSON.stringify({ code: 401, message: '未登录' }), { status: 401 });
    if (request.method !== 'POST') return new Response(JSON.stringify({ code: 405 }), { status: 405 });
    
    try {
        const formData = await request.formData();
        const file = formData.get('image');
        if (!file || !file.size) {
            return new Response(JSON.stringify({ code: 400, message: '请选择图片文件' }), { headers: { 'Content-Type': 'application/json' } });
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return new Response(JSON.stringify({ code: 400, message: '不支持的图片格式' }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({ code: 400, message: '图片不能超过5MB' }), { headers: { 'Content-Type': 'application/json' } });
        }
        const bytes = await file.arrayBuffer();
        const uint8 = new Uint8Array(bytes);
        let binary = '';
        const chunkSize = 64000;
        for (let i = 0; i < uint8.length; i += chunkSize) {
            const chunk = uint8.subarray(i, i + chunkSize);
            const chunkStr = Array.from(chunk, byte => String.fromCharCode(byte)).join('');
            binary += chunkStr;
        }
        const base64 = btoa(binary);
        const ext = file.type.split('/')[1] || 'jpg';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `${timestamp}_${random}.${ext}`;
        await kv.put(`img:${filename}`, `data:${file.type};base64,${base64}`, { expirationTtl: 86400 * 30 });
        return new Response(JSON.stringify({ code: 200, url: `/api/image/${filename}` }), { headers: { 'Content-Type': 'application/json' } });
    } catch(e) {
        return new Response(JSON.stringify({ code: 500, message: '上传失败: ' + e.message }), { headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleImage(request, kv) {
    const url = new URL(request.url);
    const filename = url.pathname.split('/').pop();
    if (!filename) return new Response('Not found', { status: 404 });
    const data = await kv.get(`img:${filename}`);
    if (!data) return new Response('Not found', { status: 404 });
    const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return new Response('Invalid image data', { status: 500 });
    return new Response(Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)), {
        headers: { 'Content-Type': match[1], 'Cache-Control': 'public, max-age=86400' }
    });
}

async function handleImagesApi(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    let isLoggedIn = false;
    if (match) {
        const session = await kv.get(`session:${match[1]}`);
        isLoggedIn = session !== null;
    }
    if (!isLoggedIn) return new Response(JSON.stringify({ code: 401, message: '未登录' }), { status: 401 });
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === 'GET' && path === '/api/images') {
        try {
            const images = [];
            if (typeof kv.list === 'function') {
                const list = await kv.list({ prefix: 'img:' });
                for (const key of list.keys) {
                    const filename = key.name.replace('img:', '');
                    images.push({ key: filename, url: `/api/image/${filename}`, name: filename });
                }
            }
            images.sort((a, b) => b.key.localeCompare(a.key));
            return new Response(JSON.stringify({ code: 200, images: images.slice(0, 100) }), { headers: { 'Content-Type': 'application/json' } });
        } catch(e) {
            return new Response(JSON.stringify({ code: 500, message: e.message }), { headers: { 'Content-Type': 'application/json' } });
        }
    }
    
    if (request.method === 'DELETE' && path.startsWith('/api/images/')) {
        const key = path.split('/')[3];
        if (!key) return new Response(JSON.stringify({ code: 400, message: '缺少图片标识' }), { headers: { 'Content-Type': 'application/json' } });
        try {
            await kv.delete(`img:${key}`);
            return new Response(JSON.stringify({ code: 200, message: '删除成功' }), { headers: { 'Content-Type': 'application/json' } });
        } catch(e) {
            return new Response(JSON.stringify({ code: 500, message: e.message }), { headers: { 'Content-Type': 'application/json' } });
        }
    }
    return new Response(JSON.stringify({ code: 404 }), { status: 404 });
}

async function handleLogout(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match) await kv.delete(`session:${match[1]}`);
    return new Response(null, { status: 302, headers: { 'Location': '/', 'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Max-Age=0' } });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
