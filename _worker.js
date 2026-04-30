// 旭儿导航 - 书签管理 + 文章管理
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const kv = env.NAV_KV;

        // 后台管理
        if (path === '/admin') {
            return handleAdmin(request, kv);
        }
        // 退出登录
        if (path === '/logout') {
            return handleLogout(request, kv);
        }
        // API
        if (path.startsWith('/api/')) {
            return handleApi(request, kv);
        }
        // 首页
        return handleHome(request, kv);
    }
};

// ==================== 首页 ====================
async function handleHome(request, kv) {
    let sites = [];
    let posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }

    // 只显示已发布的文章
    const publishedPosts = posts.filter(p => p.status === 'published').slice(0, 5);

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>旭儿导航</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 20px; margin-bottom: 30px; text-align: center; }
        .header h1 { font-size: 36px; margin-bottom: 10px; }
        .section { background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .section h2 { margin-bottom: 20px; font-size: 20px; color: #333; border-left: 4px solid #667eea; padding-left: 12px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .card { background: #f8f9fa; border-radius: 12px; padding: 16px; transition: transform 0.2s; }
        .card:hover { transform: translateY(-2px); }
        .card a { text-decoration: none; color: #333; display: block; }
        .card h3 { font-size: 16px; margin-bottom: 6px; color: #667eea; }
        .card p { font-size: 13px; color: #888; }
        .post-item { border-bottom: 1px solid #eee; padding: 12px 0; }
        .post-item:last-child { border-bottom: none; }
        .post-title { font-size: 16px; font-weight: 600; color: #333; text-decoration: none; }
        .post-title:hover { color: #667eea; }
        .post-meta { font-size: 12px; color: #888; margin-top: 6px; }
        .admin-btn { display: inline-block; margin-top: 20px; background: #667eea; color: white; padding: 10px 24px; border-radius: 30px; text-decoration: none; }
        .empty { text-align: center; padding: 40px; color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 旭儿导航</h1>
            <p>精选网站 · 优质博客</p>
        </div>
        
        <div class="section">
            <h2>📖 最新文章</h2>
            ${publishedPosts.length === 0 ? '<div class="empty">暂无文章</div>' : publishedPosts.map(p => `
                <div class="post-item">
                    <a href="/post/${p.id}" class="post-title">${escapeHtml(p.title)}</a>
                    <div class="post-meta">📅 ${new Date(p.createdAt).toLocaleDateString()} | 🏷️ ${escapeHtml(p.category || '未分类')}</div>
                </div>
            `).join('')}
        </div>
        
        <div class="section">
            <h2>🔖 常用网站</h2>
            <div class="grid">
                ${sites.map(s => `
                    <div class="card">
                        <a href="${s.url}" target="_blank">
                            <h3>${escapeHtml(s.name)}</h3>
                            <p>${escapeHtml(s.catelog)}</p>
                        </a>
                    </div>
                `).join('')}
                ${sites.length === 0 ? '<div class="empty">暂无书签，请前往后台添加</div>' : ''}
            </div>
        </div>
        
        <div style="text-align: center;">
            <a href="/admin" class="admin-btn">⚙️ 后台管理</a>
        </div>
    </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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

    // 处理登录 POST
    if (request.method === 'POST') {
        const form = await request.formData();
        const password = form.get('password');
        const adminPass = await kv.get('admin_password') || 'admin123';
        
        if (password === adminPass) {
            const token = crypto.randomUUID();
            await kv.put(`session:${token}`, 'active', { expirationTtl: 86400 });
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/admin',
                    'Set-Cookie': `admin_token=${token}; Path=/; HttpOnly; Max-Age=86400`
                }
            });
        }
        return new Response('密码错误，<a href="/admin">返回</a>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    // 未登录：显示登录页
    if (!isLoggedIn) {
        const loginHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>管理员登录</title>
    <style>
        body { font-family: system-ui; background: linear-gradient(135deg, #667eea, #764ba2); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
        .box { background: white; padding: 40px; border-radius: 20px; width: 320px; text-align: center; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; }
        button { width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="box">
        <h2>🔐 管理员登录</h2>
        <form method="post">
            <input type="password" name="password" placeholder="请输入密码" required>
            <button type="submit">登录</button>
        </form>
    </div>
</body>
</html>`;
        return new Response(loginHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 已登录：管理界面
    let sites = [];
    let posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }

    const adminHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>管理后台</title>
    <style>
        body { font-family: system-ui; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
        .card h3 { margin-bottom: 16px; font-size: 18px; }
        .form-group { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .form-group input, .form-group textarea, .form-group select { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
        .form-group textarea { min-width: 100%; }
        button { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; }
        .delete-btn { background: #e53e3e; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; }
        .status-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; }
        .status-published { background: #d4edda; color: #155724; }
        .status-draft { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 管理后台</h1>
            <a href="/logout" style="color: #e53e3e;">退出登录</a>
        </div>
        
        <!-- 文章管理 -->
        <div class="card">
            <h3>📝 发布文章</h3>
            <div class="form-group">
                <input type="text" id="postTitle" placeholder="文章标题">
            </div>
            <div class="form-group">
                <input type="text" id="postCategory" placeholder="分类（可选）">
                <select id="postStatus">
                    <option value="published">发布</option>
                    <option value="draft">草稿</option>
                </select>
            </div>
            <div class="form-group">
                <textarea id="postContent" rows="6" placeholder="文章内容..."></textarea>
            </div>
            <button onclick="addPost()">发布文章</button>
        </div>
        
        <div class="card">
            <h3>📖 文章列表</h3>
            <div class="form-group">
                <input type="text" id="searchPost" placeholder="搜索文章..." onkeyup="searchPosts()">
            </div>
            <table id="postsTable">
                <thead><tr><th>标题</th><th>分类</th><th>状态</th><th>日期</th><th>操作</th></tr></thead>
                <tbody id="postList"></tbody>
            </table>
        </div>
        
        <!-- 书签管理 -->
        <div class="card">
            <h3>➕ 添加书签</h3>
            <div class="form-group">
                <input type="text" id="siteName" placeholder="网站名称">
                <input type="url" id="siteUrl" placeholder="网址">
                <input type="text" id="siteCat" placeholder="分类">
                <button onclick="addBookmark()">添加</button>
            </div>
        </div>
        
        <div class="card">
            <h3>🔖 书签列表</h3>
            <table>
                <thead><tr><th>名称</th><th>网址</th><th>分类</th><th>操作</th></tr></thead>
                <tbody id="bookmarkList"></tbody>
            </table>
        </div>
    </div>
    
    <script>
        // 数据
        let allPosts = ${JSON.stringify(posts)};
        let allSites = ${JSON.stringify(sites)};
        
        function escape(str) {
            return String(str).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }
        
        // ========== 文章管理 ==========
        function renderPosts(filter = '') {
            const tbody = document.getElementById('postList');
            let filtered = allPosts;
            if (filter) {
                filtered = allPosts.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()));
            }
            tbody.innerHTML = filtered.map(p => \`
                <tr>
                    <td><strong>\${escape(p.title)}</strong></td>
                    <td>\${escape(p.category || '未分类')}</td>
                    <td><span class="status-badge \${p.status === 'published' ? 'status-published' : 'status-draft'}">\${p.status === 'published' ? '已发布' : '草稿'}</span></td>
                    <td>\${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                    <td>
                        <button onclick="editPost(\${p.id})" style="background:#ed8936;">编辑</button>
                        <button class="delete-btn" onclick="deletePost(\${p.id})">删除</button>
                    </td>
                </tr>
            \`).join('');
        }
        
        function searchPosts() {
            const keyword = document.getElementById('searchPost').value;
            renderPosts(keyword);
        }
        
        async function addPost() {
            const title = document.getElementById('postTitle').value.trim();
            const content = document.getElementById('postContent').value.trim();
            const category = document.getElementById('postCategory').value.trim();
            const status = document.getElementById('postStatus').value;
            if (!title || !content) {
                alert('请填写标题和内容');
                return;
            }
            const res = await fetch('/api/blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, category, status })
            });
            if (res.ok) {
                location.reload();
            } else {
                alert('发布失败');
            }
        }
        
        async function editPost(id) {
            const post = allPosts.find(p => p.id === id);
            if (!post) return;
            const newTitle = prompt('修改标题', post.title);
            if (newTitle && newTitle !== post.title) {
                const res = await fetch('/api/blog/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle })
                });
                if (res.ok) location.reload();
            }
        }
        
        async function deletePost(id) {
            if (!confirm('确定删除这篇文章？')) return;
            const res = await fetch('/api/blog/' + id, { method: 'DELETE' });
            if (res.ok) location.reload();
            else alert('删除失败');
        }
        
        // ========== 书签管理 ==========
        function renderBookmarks() {
            const tbody = document.getElementById('bookmarkList');
            tbody.innerHTML = allSites.map(s => \`
                <tr>
                    <td><strong>\${escape(s.name)}</strong></td>
                    <td><a href="\${s.url}" target="_blank">\${escape(s.url)}</a></td>
                    <td>\${escape(s.catelog)}</td>
                    <td><button class="delete-btn" onclick="deleteBookmark(\${s.id})">删除</button></td>
                </tr>
            \`).join('');
        }
        
        async function addBookmark() {
            const name = document.getElementById('siteName').value.trim();
            const url = document.getElementById('siteUrl').value.trim();
            const catelog = document.getElementById('siteCat').value.trim();
            if (!name || !url || !catelog) {
                alert('请填写完整');
                return;
            }
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, catelog })
            });
            if (res.ok) {
                location.reload();
            } else {
                alert('添加失败');
            }
        }
        
        async function deleteBookmark(id) {
            if (!confirm('确定删除？')) return;
            const res = await fetch('/api/config/' + id, { method: 'DELETE' });
            if (res.ok) {
                location.reload();
            } else {
                alert('删除失败');
            }
        }
        
        // 初始化
        renderPosts();
        renderBookmarks();
    </script>
</body>
</html>`;
    return new Response(adminHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== API ====================
async function handleApi(request, kv) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 获取书签
    if (request.method === 'GET' && path === '/api/config') {
        let sites = [];
        try {
            const data = await kv.get('sites');
            if (data) sites = JSON.parse(data);
        } catch(e) { }
        return new Response(JSON.stringify({ code: 200, data: sites }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 添加书签
    if (request.method === 'POST' && path === '/api/config') {
        const body = await request.json();
        let sites = [];
        try {
            const data = await kv.get('sites');
            if (data) sites = JSON.parse(data);
        } catch(e) { }
        const newId = sites.length ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        sites.push({ id: newId, name: body.name, url: body.url, catelog: body.catelog });
        await kv.put('sites', JSON.stringify(sites));
        return new Response(JSON.stringify({ code: 201 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 删除书签
    if (request.method === 'DELETE' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        let sites = [];
        try {
            const data = await kv.get('sites');
            if (data) sites = JSON.parse(data);
        } catch(e) { }
        const newSites = sites.filter(s => s.id !== id);
        await kv.put('sites', JSON.stringify(newSites));
        return new Response(JSON.stringify({ code: 200 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 获取文章列表
    if (request.method === 'GET' && path === '/api/blog') {
        let posts = [];
        try {
            const data = await kv.get('blog_posts');
            if (data) posts = JSON.parse(data);
        } catch(e) { }
        return new Response(JSON.stringify({ code: 200, data: posts }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 发布文章
    if (request.method === 'POST' && path === '/api/blog') {
        const body = await request.json();
        let posts = [];
        try {
            const data = await kv.get('blog_posts');
            if (data) posts = JSON.parse(data);
        } catch(e) { }
        const newPost = {
            id: Date.now(),
            title: body.title,
            content: body.content,
            category: body.category || '未分类',
            status: body.status || 'published',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        posts.push(newPost);
        await kv.put('blog_posts', JSON.stringify(posts));
        return new Response(JSON.stringify({ code: 201 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 更新文章
    if (request.method === 'PUT' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        const body = await request.json();
        let posts = [];
        try {
            const data = await kv.get('blog_posts');
            if (data) posts = JSON.parse(data);
        } catch(e) { }
        const index = posts.findIndex(p => p.id === id);
        if (index !== -1) {
            posts[index] = { ...posts[index], ...body, updatedAt: new Date().toISOString() };
            await kv.put('blog_posts', JSON.stringify(posts));
        }
        return new Response(JSON.stringify({ code: 200 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 删除文章
    if (request.method === 'DELETE' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        let posts = [];
        try {
            const data = await kv.get('blog_posts');
            if (data) posts = JSON.parse(data);
        } catch(e) { }
        const newPosts = posts.filter(p => p.id !== id);
        await kv.put('blog_posts', JSON.stringify(newPosts));
        return new Response(JSON.stringify({ code: 200 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response(JSON.stringify({ code: 404 }), { status: 404 });
}

// ==================== 退出登录 ====================
async function handleLogout(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match) {
        await kv.delete(`session:${match[1]}`);
    }
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/',
            'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Max-Age=0'
        }
    });
}

// ==================== 辅助函数 ====================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
