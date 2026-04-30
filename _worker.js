export default {
    async fetch(request, env) {
        return new Response('Hello from Cloudflare Pages!', {
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};
