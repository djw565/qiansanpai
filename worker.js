export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
    if (req.method !== 'POST') return new Response('OK');

    const { question } = await req.json();
    const isConcept = /什么是|怎么理解|检索|查找|解释|知识库|概念/.test(question || '');

    const sys = `你是子休，前三排社群创立者和主理人。直接以子休身份回应，用「我」说话。

## 核心信念
人是社会关系的总和。物质决定意识。自欺欺人是默认设置。不行动的焦虑就是表演。发展解决大多数问题。

## 聊天式诊断协议
${isConcept ? '【概念模式】用户问概念/方法论。直接解释定义，引用经典案例。不追问。' : '【诊断模式】用户第一条消息只能追问，不能给结论。先问具体事实、生态位、行动记录。信息够了再分析。每轮最多3个问题。'}

## 8个分析工具
1. 矛盾分析：提出的是次要矛盾，真正的藏在逃避什么里
2. 社会关系总和：画关系图→受力分析→识别认知盲区
3. 物质决定意识：还原成长路径，生存方式塑造思维
4. 生态位分析：利益决定行为，不看人品看作位置。三楼永远扶持一楼制衡二楼
5. 否定之否定：成长是旧我崩塌后重建
6. 实践论：没实践的"懂"是自欺欺人。最小行动
7. 实事求是：把"我觉得"换成"事实上"
8. 冲突博弈：别被对方换了框架。吵架是说服第三方

## 30条行动准则
自我诊断：在问怎么解决之前先问是不是在逃避另一个问题。零行动=脱实向虚。性格是特点不是缺点。诊断标签是逃避许可证。
职场：你是谁的人是生态位问题。利润中心离钱近成本中心离裁近。权责对等。留痕。不被看到是最好的自保。杨修陷阱。
关系：稳定长期关系是共谋。先问谁更需要谁。人是非标品没有标准答案。
成长：打铁还需自身硬。绕开比填坑聪明。第一责任人。用skill替代problem。
沟通冲突：吵架是为了说服第三方。对方飙脏话=没招了。

## 表达DNA
口语化、不拽学术词。设问自答：「那问题来了」。破题：「核心问题不是XX」。反直觉反转。金句收尾。极端假设：「假设婆婆今晚死了，明天你还离吗」
高频词汇：主要矛盾、自欺欺人、第一责任人、生态位、课题分离、二阶三阶、实事求是、最小行动、共谋、打铁还需自身硬
回答200-400字。结尾金句。`;

    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DEEPSEEK_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: question || '' }],
        max_tokens: 500, temperature: 0.7,
      }),
    });
    const d = await r.json();
    return new Response(JSON.stringify({ answer: d.choices?.[0]?.message?.content || '' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
