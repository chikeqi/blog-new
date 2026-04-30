// 旭儿导航 - 书签管理 + 文章管理 + 文章详情页 + 完整编辑功能 #3
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const kv = env.NAV_KV;

        if (path === '/admin') {
            return handleAdmin(request, kv);
        }
        if (path === '/logout') {
            return handleLogout(request, kv);
        }
        if (path.startsWith('/post/')) {
            return handlePost(request, kv);
        }
        if (path.startsWith('/api/')) {
            return handleApi(request, kv);
        }
        return handleHome(request, kv);
    }
};

async function handleHome(request, kv) {
    let sites = [];
    let posts = [];
    try {
        const sitesData = await kv.get('sites');
        if (sitesData) sites = JSON.parse(sitesData);
        const postsData = await kv.get('blog_posts');
        if (postsData) posts = JSON.parse(postsData);
    } catch(e) { }

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
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 16px; padding: 24px; width: 90%; max-width: 600px; }
        .modal-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .close-btn { font-size: 24px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 管理后台</h1>
            <a href="/logout" style="color: #e53e3e;">退出登录</a>
        </div>
        
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
            <table>
                <thead><tr><th>标题</th><th>分类</th><th>状态</th><th>日期</th><th>操作</th></tr></thead>
                <tbody id="postList"></tbody>
            </table>
        </div>
        
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
    
    <!-- 编辑文章弹窗 -->
    <div id="editModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>编辑文章</h3>
                <span class="close-btn" onclick="closeEditModal()">&times;</span>
            </div>
            <input type="hidden" id="editId">
            <div class="form-group">
                <label>标题</label>
                <input type="text" id="editTitle" style="width:100%">
            </div>
            <div class="form-group">
                <label>分类</label>
                <input type="text" id="editCategory" style="width:100%">
            </div>
            <div class="form-group">
                <label>状态</label>
                <select id="editStatus" style="width:100%">
                    <option value="published">发布</option>
                    <option value="draft">草稿</option>
                </select>
            </div>
            <div class="form-group">
                <label>内容</label>
                <textarea id="editContent" rows="8" style="width:100%"></textarea>
            </div>
            <button onclick="saveEdit()" style="margin-top:10px">保存修改</button>
        </div>
    </div>
    
    <script>
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
        
        function renderPosts(filter = '') {
            const tbody = document.getElementById('postList');
            let filtered = allPosts;
            if (filter) filtered = allPosts.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()));
            tbody.innerHTML = filtered.map(p => \`
                <tr>
                    <td><strong>\${escape(p.title)}</strong></span>${p.status === 'draft' ? ' <span style="color:#856404;font-size:12px;">[草稿]</span>' : ''}</td>
                    <td>\${escape(p.category || '未分类')}</td>
                    <td><span class="status-badge \${p.status === 'published' ? 'status-published' : 'status-draft'}">\${p.status === 'published' ? '已发布' : '草稿'}</span></span></td>
                    <td>\${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</span></span></td>
                    <td>
                        <button onclick="openEditModal(\${p.id})" style="background:#ed8936;">编辑</button>
                        <button class="delete-btn" onclick="deletePost(\${p.id})">删除</button>
                    </span></span>
                </tr>
            \`).join('');
        }
        
        function searchPosts() {
            renderPosts(document.getElementById('searchPost').value);
        }
        
        // 打开编辑弹窗
        function openEditModal(id) {
            const post = allPosts.find(p => p.id === id);
            if (!post) return;
            document.getElementById('editId').value = post.id;
            document.getElementById('editTitle').value = post.title;
            document.getElementById('editCategory').value = post.category || '';
            document.getElementById('editStatus').value = post.status || 'published';
            document.getElementById('editContent').value = post.content || '';
            document.getElementById('editModal').style.display = 'flex';
        }
        
        function closeEditModal() {
            document.getElementById('editModal').style.display = 'none';
        }
        
        // 保存编辑
        async function saveEdit() {
            const id = parseInt(document.getElementById('editId').value);
            const title = document.getElementById('editTitle').value.trim();
            const category = document.getElementById('editCategory').value.trim();
            const status = document.getElementById('editStatus').value;
            const content = document.getElementById('editContent').value;
            
            if (!title || !content) {
                alert('请填写标题和内容');
                return;
            }
            
            const res = await fetch('/api/blog/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, category, status, content })
            });
            if (res.ok) {
                location.reload();
            } else {
                alert('保存失败');
            }
        }
        
        async function addPost() {
            const title = document.getElementById('postTitle').value.trim();
            const content = document.getElementById('postContent').value.trim();
            const category = document.getElementById('postCategory').value.trim();
            const status = document.getElementById('postStatus').value;
            if (!title || !content) { alert('请填写标题和内容'); return; }
            const res = await fetch('/api/blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, category, status })
            });
            if (res.ok) location.reload();
            else alert('发布失败');
        }
        
        async function deletePost(id) {
            if (!confirm('确定删除？')) return;
            const res = await fetch('/api/blog/' + id, { method: 'DELETE' });
            if (res.ok) location.reload();
            else alert('删除失败');
        }
        
        function renderBookmarks() {
            const tbody = document.getElementById('bookmarkList');
            tbody.innerHTML = allSites.map(s => \`
                <tr>
                    <td><strong>\${escape(s.name)}</strong></span></td>
                    <td><a href="\${s.url}" target="_blank">\${escape(s.url)}</a></span></td>
                    <td>\${escape(s.catelog)}</span></span></span></td>
                    <td><button class="delete-btn" onclick="deleteBookmark(\${s.id})">删除</button></span></td>
                </tr>
            \`).join('');
        }
        
        async function addBookmark() {
            const name = document.getElementById('siteName').value.trim();
            const url = document.getElementById('siteUrl').value.trim();
            const catelog = document.getElementById('siteCat').value.trim();
            if (!name || !url || !catelog) { alert('请填写完整'); return; }
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, catelog })
            });
            if (res.ok) location.reload();
            else alert('添加失败');
        }
        
        async function deleteBookmark(id) {
            if (!confirm('确定删除？')) return;
            const res = await fetch('/api/config/' + id, { method: 'DELETE' });
            if (res.ok) location.reload();
            else alert('删除失败');
        }
        
        renderPosts();
        renderBookmarks();
    </script>
</body>
</html>`;
    return new Response(adminHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'PUT' && path.startsWith('/api/blog/')) {
        const id = parseInt(path.split('/')[3]);
        const body = await request.json();
        let posts = [];
        try { const data = await kv.get('blog_posts'); if (data) posts = JSON.parse(data); } catch(e) { }
        const index = posts.findIndex(p => p.id === id);
        if (index !== -1) {
            posts[index] = { 
                ...posts[index], 
                title: body.title !== undefined ? body.title : posts[index].title,
                content: body.content !== undefined ? body.content : posts[index].content,
                category: body.category !== undefined ? body.category : posts[index].category,
                status: body.status !== undefined ? body.status : posts[index].status,
                updatedAt: new Date().toISOString()
            };
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
    return new Response(null, {
        status: 302,
        headers: { 'Location': '/', 'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Max-Age=0' }
    });
}

// ==================== 文章详情页 ====================
async function handlePost(request, kv) {
    const url = new URL(request.url);
    const id = parseInt(url.pathname.split('/')[2]);
    
    if (isNaN(id)) {
        return new Response('文章不存在', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    
    let posts = [];
    try {
        const data = await kv.get('blog_posts');
        if (data) posts = JSON.parse(data);
    } catch(e) { }
    
    const post = posts.find(p => p.id === id);
    
    if (!post || post.status !== 'published') {
        return new Response('文章不存在或未发布', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    
    let views = 0;
    try {
        const viewsData = await kv.get(`views:${id}`);
        if (viewsData) views = parseInt(viewsData);
        views++;
        await kv.put(`views:${id}`, views.toString());
    } catch(e) { }
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(post.title)} - 旭儿导航</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .article { background: white; border-radius: 20px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        h1 { font-size: 28px; margin-bottom: 16px; color: #333; }
        .meta { color: #888; font-size: 14px; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
        .content { line-height: 1.8; font-size: 16px; color: #444; }
        .content p { margin-bottom: 16px; }
        .back-btn { display: inline-block; margin-top: 30px; background: #667eea; color: white; padding: 10px 24px; border-radius: 30px; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="article">
            <h1>${escapeHtml(post.title)}</h1>
            <div class="meta">
                分类：${escapeHtml(post.category || '未分类')} | 
                发布时间：${new Date(post.createdAt).toLocaleDateString()} |
                阅读：${views}次
            </div>
            <div class="content">
                ${post.content.replace(/\n/g, '<br>')}
            </div>
            <a href="/" class="back-btn">← 返回首页</a>
        </div>
    </div>
</body>
</html>`;
    
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
