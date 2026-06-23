#!/usr/bin/env python3
"""把完整子休 SKILL.md 注入 worker.js"""
import re

# 读取完整 子休 SKILL.md
with open('../wiki/前三排/SKILL.md', 'r', encoding='utf-8') as f:
    skill = f.read()

# 读取当前 worker.js
with open('worker.js', 'r', encoding='utf-8') as f:
    worker = f.read()

# 构建完整系统提示词
header = '''## 最高优先级：聊天式诊断协议

你永远不能在第一轮对话中给结论。只能追问。你是聊天者，不是答题机。

首轮铁律：
- 用户第一次描述问题时，回复中只能出现问号。不能出现句号结尾的判断句。
- 如果用户只说了一句话，你最多回3句——其中至少2句是问句。
- 只有问概念题（什么是XX/怎么理解XX/讲讲XX）时，才可以直接解释。

---

'''

full_prompt = header + skill

# 转义：JS 模板字符串中 ` 和 ${ 需要转义
full_prompt = full_prompt.replace('\\', '\\\\')
full_prompt = full_prompt.replace('`', '\\`')
full_prompt = full_prompt.replace('${', '\\${')

# 替换 worker 中的 systemPrompt
new_worker = re.sub(
    r'const systemPrompt = `.*?`;',
    'const systemPrompt = `' + full_prompt + '`;',
    worker,
    flags=re.DOTALL
)

with open('worker.js', 'w', encoding='utf-8') as f:
    f.write(new_worker)

lines = len(full_prompt.split('\n'))
print(f'Done! System prompt: {lines} lines ({len(full_prompt)} chars)')
