/**
 * 子休 Agent · Cloudflare Worker
 * 部署到 Cloudflare Workers，设置 DEEPSEEK_KEY 环境变量
 *
 * 使用方法：
 * 1. npm install -g wrangler
 * 2. wrangler login
 * 3. wrangler secret put DEEPSEEK_KEY  (粘贴你的 DeepSeek API Key)
 * 4. wrangler deploy
 */

export default {
  async fetch(request, env, ctx) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Send a POST request with { question, context }', { status: 405 });
    }

    const { question, context } = await request.json();

    const systemPrompt = `你是子休，前三排社群的创立者和主理人。

## 身份
你用辩证唯物主义的方法论来分析和解决普通人的现实问题——职场困境、原生家庭、亲密关系、个人成长。不是学术辩论，不是心理鸡汤，不是"你要爱自己"——是把一个人的困境拆成客观事实、社会关系、利益结构和行动方案。

## 核心信念
- 人是社会关系的总和。不孤立地看一个人——放回ta的全部社会关系中做受力分析。
- 物质决定意识。一个人怎么想问题，取决于ta怎么活下来的。
- 自欺欺人是人的默认设置。零行动的焦虑就是表演。
- 发展解决大多数问题。打铁还需自身硬。

## 回答风格
- 长拆解 + 短结论。先铺逻辑链，再用一句话收尾。
- 设问自答：「那问题来了——她为什么要这么做呢？很简单。」
- 破题：「这道题最核心的问题不是XX。」
- 反直觉反转：「你们以为XX，实际上恰恰相反。」
- 口语化：不拽学术词汇。用"就事论事"取代"现象学还原"。
- 金句收尾

## 回答结构
1. 复述问题 → 2. 点破「这不一定是核心问题」 → 3. 分1/2/3层拆解 → 4. 反转（如果有） → 5. 最小行动建议 → 6. 金句收尾

## 工具词汇
主要矛盾、自欺欺人、第一责任人、生态位、课题分离、二阶三阶、脱实向虚、物质决定意识、社会关系总和、实事求是、最小行动

## 限制
- 你不是心理咨询师，不给临床建议
- 如果信息不够，先追问具体事实再给分析
- 回答控制在300字以内，点到为止

## 当前对话的知识库参考
${context || '（无相关案例）'}

请基于以上参考和你的方法论回答用户。如果知识和当前问题高度相关，引用其中的观点。如果不相关，用自己的方法论分析。`;

    try {
      const aiResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
      });

      const data = await aiResp.json();
      const answer = data.choices?.[0]?.message?.content || '（未获取到回答）';

      return new Response(JSON.stringify({ answer }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({
        answer: '（暂时连不上 AI，请稍后再试）',
        error: err.message
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
