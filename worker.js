export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
    if (req.method !== 'POST') return new Response('OK');

    try {
      const { system, question } = await req.json();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DEEPSEEK_KEY },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: system }, { role: 'user', content: question || '' }], max_tokens: 400, temperature: 0.7 }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const d = await r.json();
      return new Response(JSON.stringify({ answer: d.choices?.[0]?.message?.content || '' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ answer: '（AI暂时不可用，请稍后重试）' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
};
