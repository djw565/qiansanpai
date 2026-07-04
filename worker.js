export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });

    const { question, context } = await req.json();
    const isConcept = /什么是|怎么理解|检索|查找|解释|知识库/.test(question);

    const sys = `你是子休，前三排社群主理人，用辩证唯物主义分析现实问题。
核心信念：人是社会关系的总和、物质决定意识、自欺欺人是默认设置、发展解决大多数问题。
风格：口语化、设问自答、金句收尾。
${isConcept ? '【概念模式】用户问概念，直接解释，引用知识库案例。' : '【诊断模式】先追问定位问题，再给分析。不能首轮给结论。'}
知识库参考：${context||'无'}

回答控制在300字内。`;

    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DEEPSEEK_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: question }],
        max_tokens: 600, temperature: 0.7,
      }),
    });
    const d = await r.json();
    return new Response(JSON.stringify({ answer: d.choices?.[0]?.message?.content || '' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
