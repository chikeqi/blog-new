export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const kv = env.NAV_KV;

        // 路由分发
        if (pathname === '/admin') return handleAdmin(request, kv);
        if (pathname === '/logout') return handleLogout(request, kv);
        if (pathname.startsWith('/api/')) return handleApi(request, kv);
        return handleHome(request, kv);
    }
};

// 首页
async function handleHome(request, kv) {
    const sites = await getSites(kv);
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>旭儿导航</title>
    <style>
        body { font-family: system-ui; background: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 16px; margin-bottom: 30px; text-align: center; }
        .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .card:hover { transform: translateY(-3px); }
        .card a { text-decoration: none; color: #333; display: block; }
        .card strong { font-size: 18px; }
        .card small { color: #667eea; }
        .admin-link { display: inline-block; margin-top: 30px; background: #667eea; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>旭儿导航</h1>
            <p>精选网站 · 优质博客</p>
        </div>
        <div class="card-grid">
            ${sites.map(s => `<div class="card"><a href="${s.url}" target="_blank"><strong>${escapeHtml(s.name)}</strong><br><small>${escapeHtml(s.catelog)}</small></a></div>`).join('')}
            ${sites.length === 0 ? '<div style="text-align:center;padding:40px;">暂无书签，<a href="/admin">去后台添加</a></div>' : ''}
        </div>
        <div style="text-align: center;"><a href="/admin" class="admin-link">⚙️ 后台管理</a></div>
    </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// 后台管理
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
        const username = form.get('username');
        const password = form.get('password');
        const adminUser = await kv.get('admin_username') || 'admin';
        const adminPass = await kv.get('admin_password') || 'admin123';
        if (username === adminUser && password === adminPass) {
            const token = crypto.randomUUID();
            await kv.put(`session:${token}`, 'active', { expirationTtl: 86400 });
            const html = `<script>document.cookie="admin_token=${token};path=/;max-age=86400";location.href="/admin"</script>`;
            return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        }
        return new Response('密码错误，<a href="/admin">返回</a>', { headers: { 'Content-Type': 'text/html' } });
    }

    if (!isLoggedIn) {
        return new Response(`<!DOCTYPE html>
<html><head><title>登录</title><style>
body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;justify-content:center;align-items:center;height:100vh;}
.box{background:white;padding:40px;border-radius:16px;width:320px;}
input,button{width:100%;padding:10px;margin:8px 0;border-radius:6px;border:1px solid #ccc;}
button{background:#667eea;color:white;border:none;cursor:pointer;}
</style></head>
<body><div class="box"><h2>管理员登录</h2><form method="post"><input name="username" placeholder="用户名"><input type="password" name="password" placeholder="密码"><button>登录</button></form></div></body></html>`, { headers: { 'Content-Type': 'text/html' } });
    }

    const sites = await getSites(kv);
    return new Response(`<!DOCTYPE html>
<html><head><title>管理后台</title><style>
body{font-family:system-ui;padding:20px;background:#f0f2f5;}
table{width:100%;border-collapse:collapse;background:white;border-radius:12px;}
th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd;}
button{padding:4px 12px;margin:2px;border:none;border-radius:4px;cursor:pointer;}
.danger{background:#e53e3e;color:white;}
.primary{background:#667eea;color:white;}
.add-form{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;}
.add-form input{flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;}
</style></head>
<body><div style="max-width:1000px;margin:0 auto">
<h1>管理后台 <a href="/logout" style="float:right;font-size:14px;">退出</a></h1>
<div class="add-form">
    <input type="text" id="name" placeholder="网站名称">
    <input type="url" id="url" placeholder="网址">
    <input type="text" id="cat" placeholder="分类">
    <button class="primary" onclick="add()">添加</button>
</div>
<table><thead><tr><th>ID</th><th>名称</th><th>网址</th><th>分类</th><th></th></tr></thead>
<tbody id="list"></tbody></table></div>
<script>
    const data = ${JSON.stringify(sites)};
    function render() {
        document.getElementById('list').innerHTML = data.map(s => \`
            <tr><td>\${s.id}</td><td>\${escape(s.name)}</td><td>\${escape(s.url)}</td><td>\${escape(s.catelog)}</td>
            <td><button class="danger" onclick="del(\${s.id})">删除</button></td></tr>
        \`).join('');
    }
    function escape(str) { return String(str).replace(/[&<>]/g, function(m){if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }
    async function add() {
        const name = document.getElementById('name').value.trim();
        const url = document.getElementById('url').value.trim();
        const catelog = document.getElementById('cat').value.trim();
        if (!name || !url || !catelog) return alert('请填写完整');
        const r = await fetch('/api/config', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,url,catelog}) });
        if (r.ok) location.reload(); else alert('失败');
    }
    async function del(id) {
        if (!confirm('确定删除?')) return;
        const r = await fetch('/api/config/'+id, { method:'DELETE' });
        if (r.ok) location.reload(); else alert('失败');
    }
    render();
</script></body></html>`, { headers: { 'Content-Type': 'text/html' } });
}

// API
async function handleApi(request, kv) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/config') {
        return new Response(JSON.stringify({ code: 200, data: await getSites(kv) }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST' && path === '/api/config') {
        const { name, url: siteUrl, catelog } = await request.json();
        let sites = await getSites(kv);
        const newId = sites.length ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        sites.push({ id: newId, name, url: siteUrl, catelog });
        await kv.put('sites', JSON.stringify(sites));
        return new Response(JSON.stringify({ code: 201 }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'DELETE' && path.startsWith('/api/config/')) {
        const id = parseInt(path.split('/')[3]);
        let sites = await getSites(kv);
        await kv.put('sites', JSON.stringify(sites.filter(s => s.id !== id)));
        return new Response(JSON.stringify({ code: 200 }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ code: 404 }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

async function handleLogout(request, kv) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match) await kv.delete(`session:${match[1]}`);
    return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' } });
}

async function getSites(kv) {
    try { const d = await kv.get('sites'); return d ? JSON.parse(d) : []; } catch { return []; }
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
