#!/usr/bin/env python3
"""把完整 SKILL.md + 43 个概念注入 Worker"""
import json, re

# 读取完整 SKILL
with open('../wiki/前三排/SKILL.md', 'r', encoding='utf-8') as f:
    skill = f.read()

# 去掉 YAML frontmatter
if skill.startswith('---'):
    end = skill.find('---', 3)
    if end != -1:
        skill = skill[end+3:].strip()

# 读取概念库
with open('concepts.json', 'r', encoding='utf-8') as f:
    concepts = json.load(f)['concepts']

# 构建概念 JS 对象
concept_pairs = []
for name, desc in concepts.items():
    short = desc[:80].replace('"', "'")
    concept_pairs.append(f'"{name}":"{short}"')
concepts_js = '{' + ','.join(concept_pairs) + '}'

# 转义 SKILL 中的特殊字符（用于 JS 模板字符串）
skill = skill.replace('\\', '\\\\')
skill = skill.replace('`', '\\`')
skill = skill.replace('${', '\\${')

worker = f'''export default {{
  async fetch(req, env) {{
    if (req.method === 'OPTIONS') return new Response(null, {{
      headers: {{ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }}
    }});
    if (req.method !== 'POST') return new Response('OK');

    const {{ question }} = await req.json();
    const q = question || '';
    const isConcept = /什么是|怎么理解|检索|查找|解释|知识库|概念/.test(q);

    const allConcepts = {concepts_js};

    let matched = [];
    for (let name in allConcepts) {{
      if (q.indexOf(name) !== -1 || name.indexOf(q) !== -1) {{
        matched.push(name + '：' + allConcepts[name]);
      }}
    }}
    let conceptCtx = matched.length > 0 ? '\\n## 匹配到的核心概念\\n' + matched.join('\\n') : '';

    const sys = `{skill}

## 当前概念库匹配
${{conceptCtx || '（无匹配）'}}

${{isConcept ? '【概念模式】用户问概念，直接解释，引用知识库。不追问。回答200-400字。' : '【诊断模式】用户第一条消息，先追问定位，不能给结论。回答控制在200-400字。'}}`;

    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DEEPSEEK_KEY }},
      body: JSON.stringify({{ model: 'deepseek-chat', messages: [{{ role: 'system', content: sys }}, {{ role: 'user', content: q }}], max_tokens: 600, temperature: 0.7 }}),
    }});
    const d = await r.json();
    return new Response(JSON.stringify({{ answer: d.choices?.[0]?.message?.content || '' }}), {{
      headers: {{ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }},
    }});
  }}
}};
'''

with open('worker.js', 'w', encoding='utf-8') as f:
    f.write(worker)

print(f'Done! Skill: {len(skill)} chars, Concepts: {len(concepts)} items')
