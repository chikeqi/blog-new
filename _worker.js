// 纯净版 - 旭儿导航
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

// 首页 - 显示所有书签
async function handleHome(request, kv) {
    let sites = [];
    try {
        const data = await kv.get('sites');
        if (data) sites = JSON.parse(data);
    } catch(e) { sites = []; }

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
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
        .card a { text-decoration: none; color: #333; display: block; }
        .card h3 { font-size: 18px; margin-bottom: 8px; color: #667eea; }
        .card p { font-size: 13px; color: #888; }
        .admin-btn { display: inline-block; margin-top: 30px; background: #667eea; color: white; padding: 10px 24px; border-radius: 30px; text-decoration: none; }
        .empty { text-align: center; padding: 60px; color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 旭儿导航</h1>
            <p>精选网站 · 优质博客</p>
        </div>
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
        <div style="text-align: center; margin-top: 30px;">
            <a href="/admin" class="admin-btn">⚙️ 后台管理</a>
        </div>
    </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// 后台管理 - 登录和书签管理
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
    try {
        const data = await kv.get('sites');
        if (data) sites = JSON.parse(data);
    } catch(e) { sites = []; }

    const adminHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>管理后台</title>
    <style>
        body { font-family: system-ui; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; }
        .form-group { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .form-group input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
        button { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; }
        .delete-btn { background: #e53e3e; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 管理后台</h1>
            <a href="/logout" style="color: #e53e3e;">退出登录</a>
        </div>
        <div class="card">
            <h3>➕ 添加书签</h3>
            <div class="form-group">
                <input type="text" id="name" placeholder="网站名称">
                <input type="url" id="url" placeholder="网址">
                <input type="text" id="cat" placeholder="分类">
                <button onclick="addBookmark()">添加</button>
            </div>
        </div>
        <div class="card">
            <h3>📖 书签列表</h3>
            <table>
                <thead><tr><th>名称</th><th>网址</th><th>分类</th><th>操作</th></tr></thead>
                <tbody id="list"></tbody>
            </table>
        </div>
    </div>
    <script>
        const sitesData = ${JSON.stringify(sites)};
        
        function renderList() {
            const tbody = document.getElementById('list');
            tbody.innerHTML = sitesData.map(s => \`
                <tr>
                    <td><strong>\${escape(s.name)}</strong></td>
                    <td><a href="\${s.url}" target="_blank">\${escape(s.url)}</a></td>
                    <td>\${escape(s.catelog)}</td>
                    <td><button class="delete-btn" onclick="deleteBookmark(\${s.id})">删除</button></td>
                </tr>\`).join('');
        }
        
        function escape(str) {
            return String(str).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }
        
        async function addBookmark() {
            const name = document.getElementById('name').value.trim();
            const url = document.getElementById('url').value.trim();
            const catelog = document.getElementById('cat').value.trim();
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
        
        renderList();
    </script>
</body>
</html>`;
    return new Response(adminHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// API 处理
async function handleApi(request, kv) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    let sites = [];
    try {
        const data = await kv.get('sites');
        if (data) sites = JSON.parse(data);
    } catch(e) { sites = []; }
    
    // GET /api/config
    if (request.method === 'GET' && path === '/api/config') {
        return new Response(JSON.stringify({ code: 200, data: sites }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // POST /api/config
    if (request.method === 'POST' && path === '/api/config') {
        const body = await request.json();
        const { name, url: siteUrl, catelog } = body;
        const newId = sites.length ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        sites.push({ id: newId, name, url: siteUrl, catelog });
        await kv.put('sites', JSON.stringify(sites));
        return new Response(JSON.stringify({ code: 201 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // DELETE /api/config/:id
    if (request.method === 'DELETE' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        const newSites = sites.filter(s => s.id !== id);
        await kv.put('sites', JSON.stringify(newSites));
        return new Response(JSON.stringify({ code: 200 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response(JSON.stringify({ code: 404 }), { status: 404 });
}

// 退出登录
async function handleLogout(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match) {
        await kv.delete(`session:${match[1]}`);
    }
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/admin',
            'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Max-Age=0'
        }
    });
}

// 辅助函数
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
