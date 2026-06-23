#!/usr/bin/env python3
"""把 wiki/前三排/concepts/ 的 MD 概念转为概念库网站页面"""
import re
import yaml
import html as html_mod
from pathlib import Path

BASE_DIR = Path(__file__).parent
CONCEPTS_SRC = BASE_DIR.parent / "wiki" / "前三排" / "concepts"
CONCEPTS_OUT = BASE_DIR / "concept-pages"
MOC_FILE = BASE_DIR.parent / "wiki" / "mocs" / "MOC-辩证心理学.md"

CSS_PATH = "../css/style.css"

HTML_HEAD = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — 前三排 · 概念库</title>
  <link rel="stylesheet" href="{css}">
</head>
<body>
  <script src="../js/auth.js"></script>
  <header class="site-header">
    <div class="site-title"><span class="accent">前三排</span> · 概念库</div>
    <div class="site-subtitle">子休辩证唯物主义心理学</div>
  </header>'''

HTML_FOOT = '''
  <footer class="site-footer">
    <p><a href="../concepts.html">← 返回概念库</a> | <a href="../index.html">文章目录</a></p>
  </footer>
</body>
</html>'''

HTML_INDEX_HEAD = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>概念库 — 前三排 · 学习小组</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { background: #fdfaf6; font-family: "PingFang SC","Microsoft YaHei",sans-serif; }
    .concepts-hero { text-align:center; padding:3rem 1rem 2rem; }
    .concepts-hero h1 { font-size:2rem; margin-bottom:0.5rem; }
    .concepts-hero p { color:#6b6b6b; }
    .domain { max-width:900px; margin:0 auto 2rem; padding:0 1rem; }
    .domain h2 { font-size:1.3rem; color:#c44d4d; border-bottom:2px solid #c44d4d; padding-bottom:0.4rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; }
    .domain h2 .count { font-size:0.8rem; color:#999; font-weight:400; }
    .domain-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:0.7rem; }
    .concept-card { display:block; background:#fff; border-radius:8px; padding:1rem 1.2rem; box-shadow:0 1px 3px rgba(0,0,0,0.06); text-decoration:none; color:#2c2c2c; transition:all 0.2s; border-left:3px solid #c44d4d; }
    .concept-card:hover { box-shadow:0 4px 12px rgba(0,0,0,0.1); transform:translateY(-2px); }
    .concept-card h3 { font-size:1rem; margin-bottom:0.3rem; }
    .concept-card p { font-size:0.8rem; color:#6b6b6b; line-height:1.5; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .concept-card .complexity { display:inline-block; font-size:0.65rem; padding:0.1rem 0.4rem; border-radius:8px; margin-left:0.4rem; background:#f5ede1; color:#8b7355; }
    .concept-search { display:block; max-width:500px; margin:0 auto 1.5rem; padding:0.7rem 1rem; border:2px solid #e8e0d5; border-radius:25px; font-size:0.95rem; outline:none; font-family:inherit; width:100%; }
    .concept-search:focus { border-color:#c44d4d; }
    .back-home { text-align:center; padding:1rem 0 2rem; }
    .back-home a { color:#c44d4d; text-decoration:none; }
    @media (max-width:600px) { .domain-grid { grid-template-columns:1fr; } .concepts-hero h1 { font-size:1.5rem; } }
  </style>
</head>
<body>
  <script src="js/auth.js"></script>
<header class="site-header">
  <div class="site-title"><span class="accent">前三排</span> · 概念库</div>
  <div class="site-subtitle">子休辩证唯物主义心理学 — 43个核心分析工具 · 按MOC四大领域分类</div>
</header>
<main style="padding:2rem 1rem 4rem;max-width:960px;margin:0 auto;">'''

HTML_INDEX_FOOT = '''
<div class="back-home">
  <a href="index.html">← 返回文章目录</a> | <a href="agent.html">💬 子休问答</a>
</div>
</main>
</body>
</html>'''


def parse_frontmatter(text: str) -> dict:
    """解析 YAML frontmatter"""
    if not text.startswith('---'):
        return {}
    end = text.find('---', 3)
    if end == -1:
        return {}
    try:
        return yaml.safe_load(text[3:end]) or {}
    except:
        return {}


def md_to_html(text: str) -> str:
    """简单 Markdown → HTML 转换"""
    lines = text.split('\n')
    out = []
    in_code = False

    for line in lines:
        # 代码块
        if line.strip().startswith('```'):
            in_code = not in_code
            out.append('<pre><code>' if not in_code else '</code></pre>')
            continue
        if in_code:
            out.append(html_mod.escape(line))
            continue

        # 标题
        if line.startswith('### '):
            out.append(f'<h3>{html_mod.escape(line[4:])}</h3>')
        elif line.startswith('## '):
            out.append(f'<h2>{html_mod.escape(line[3:])}</h2>')
        elif line.startswith('# '):
            continue  # 跳过一级标题（页面已有）

        # 引用
        elif line.startswith('> '):
            out.append(f'<blockquote>{html_mod.escape(line[2:])}</blockquote>')

        # 列表
        elif line.startswith('- '):
            out.append(f'<li>{inline_md(line[2:])}</li>')
        elif re.match(r'^\d+\. ', line):
            out.append(f'<li>{inline_md(re.sub(r"^\d+\. ", "", line))}</li>')

        # 加粗文本作为小标题
        elif line.startswith('**') and line.endswith('**'):
            out.append(f'<h4>{line[2:-2]}</h4>')

        # 空行
        elif not line.strip():
            out.append('')

        # 普通段落
        else:
            out.append(f'<p>{inline_md(line)}</p>')

    return '\n'.join(out)


def inline_md(text: str) -> str:
    """行内 Markdown → HTML"""
    text = html_mod.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\[\[([^\]]+)\]\]', r'<em>\1</em>', text)
    return text


def build_concept_pages():
    """生成概念页面"""
    CONCEPTS_OUT.mkdir(exist_ok=True)

    md_files = sorted(CONCEPTS_SRC.glob("*.md"))
    concepts_data = []

    for md_file in md_files:
        content = md_file.read_text(encoding='utf-8')
        fm = parse_frontmatter(content)

        # 移除 frontmatter
        if content.startswith('---'):
            end = content.find('---', 3)
            body = content[end+3:].strip() if end != -1 else content
        else:
            body = content

        title = fm.get('title', md_file.stem)
        tags = fm.get('tags', [])
        complexity = fm.get('complexity', 'medium')

        html_body = md_to_html(body)
        slug = re.sub(r'[^\w]', '-', md_file.stem)

        page = HTML_HEAD.format(title=html_mod.escape(title), css=CSS_PATH)
        page += f'''
  <main class="article-page">
    <a href="../concepts.html" class="back-link">← 返回概念库</a>
    <article>
      <header class="article-header">
        <h1>{html_mod.escape(title)}</h1>
        <div class="article-meta">
          <span class="article-type">{complexity}</span>
          {' '.join(f'<span class="article-type">{t}</span>' for t in tags if t != '前三排')}
        </div>
      </header>
      <div class="article-body">
        {html_body}
      </div>
    </article>
  </main>'''
        page += HTML_FOOT

        out_file = CONCEPTS_OUT / f"{slug}.html"
        out_file.write_text(page, encoding='utf-8')

        # 提取摘要
        lines = [l.strip() for l in body.split('\n') if l.strip() and not l.startswith('#')]
        excerpt = lines[0] if lines else ''
        if len(excerpt) > 100:
            excerpt = excerpt[:100] + '…'

        concepts_data.append({
            'title': title,
            'slug': slug,
            'tags': tags,
            'complexity': complexity,
            'excerpt': excerpt,
        })

        print(f"  [OK] {title}")

    return concepts_data


def parse_moc():
    """解析 MOC 文件获取领域分类"""
    text = MOC_FILE.read_text(encoding='utf-8')
    domains = {}
    current_domain = None

    for line in text.split('\n'):
        # 匹配领域标题: ### 🌱 个人成长（15）
        m = re.match(r'###\s+.+\s+(.+)\s*[（(]\d+[）)]', line)
        if m and '静态目录' not in line:
            # 检查上一行是不是 ###
            pass
        m = re.match(r'###\s+\S+\s+(.+)', line)
        if m and current_domain is None:
            current_domain = m.group(1).strip()
            domains[current_domain] = []
            continue

        # 匹配概念链接: - [[概念名]] — 描述
        m = re.match(r'- \[\[(.+?)\]\]', line)
        if m and current_domain:
            domains[current_domain].append(m.group(1))
            continue

        # 新领域
        m = re.match(r'###\s+\S+\s+(.+)', line)
        if m and 'MOC' not in line and 'Dataview' not in line and '静态目录' not in line:
            current_domain = m.group(1).strip()
            if current_domain not in domains:
                domains[current_domain] = []

    return domains


def build_index(concepts_data: list):
    """生成概念库首页"""
    # 按 MOC 分类
    domains = parse_moc()

    # 如果 MOC 解析失败，手动分类
    if not domains:
        domains = {
            '个人成长': ['第一责任人', '挑骨头模块', '打铁还需自身硬', '从闭环到飞轮个人成长模型',
                      '否定之否定成长路径', '学生思维与职场思维', '思维三阶模型', '真懂与假懂',
                      '以身入局', '脱实向虚', '自欺欺人', '诊断标签作为逃避许可证',
                      '产品思维翻译与信息管理', '极值法', '抓主要矛盾', 'ORID模型'],
            '职场': ['生态位分析', '权责对等', '存量与增量', '外战内行内战内行',
                    '利润中心与成本中心', '昏倒羊', '留痕原则', '流量分配权决定收入上限',
                    'SOP即权力文档标准化', '体制投名状论', '杨修陷阱', '窄桥策略',
                    '职场权力博弈三楼斗二楼法则', '直系领导才是朋友', '冲突博弈框架'],
            '原生家庭': ['人是社会关系的总和', '经济基础决定上层建筑', '课题分离',
                       '多元评价体系', '人是非标品没有标准答案', '不扛事人格', '性格是特点不是缺点'],
            '亲密关系': ['二阶思维', '静态人物与动态人物', '自我攻击', '习得性无助', '跳火坑先跟后带'],
        }

    # 建立 title → slug 映射
    slug_map = {c['title']: c['slug'] for c in concepts_data}

    page = HTML_INDEX_HEAD
    page += '<div class="concepts-hero"><h1>43 个核心概念</h1><p>按四大领域分类 · 点击卡片查看完整定义与案例分析</p>'
    page += '<input type="text" id="concept-search" class="concept-search" placeholder="搜索概念…" autocomplete="off"></div>'

    total = 0
    for domain_name, items in domains.items():
        matched = []
        for item in items:
            if item in slug_map:
                c = next(c for c in concepts_data if c['title'] == item)
                matched.append(c)
            else:
                # 尝试模糊匹配
                for c in concepts_data:
                    if item in c['title'] or c['title'] in item:
                        matched.append(c)
                        break

        if matched:
            total += len(matched)
            cards = []
            for c in matched:
                comp = c.get('complexity', 'medium')
                cards.append(
                    f'<a href="concept-pages/{c["slug"]}.html" class="concept-card">'
                    f'<h3>{html_mod.escape(c["title"])}<span class="complexity">{comp}</span></h3>'
                    f'<p>{html_mod.escape(c["excerpt"])}</p></a>'
                )

            page += f'<section class="domain"><h2>{domain_name} <span class="count">({len(matched)}个)</span></h2>'
            page += f'<div class="domain-grid">{"".join(cards)}</div></section>'

    page += HTML_INDEX_FOOT

    # 添加搜索 JS
    page += '''
<script>
(function(){
  var cards = document.querySelectorAll('.concept-card');
  var domains = document.querySelectorAll('.domain');
  document.getElementById('concept-search').addEventListener('input',function(){
    var q = this.value.trim().toLowerCase();
    if(!q){ cards.forEach(function(c){c.style.display='';}); domains.forEach(function(d){d.style.display='';}); return; }
    var found = false;
    cards.forEach(function(c){
      var t = c.textContent.toLowerCase();
      if(t.indexOf(q)!==-1){ c.style.display=''; found=true; }
      else { c.style.display='none'; }
    });
    domains.forEach(function(d){
      var vis = Array.from(d.querySelectorAll('.concept-card')).some(function(c){return c.style.display!=='none';});
      d.style.display = vis ? '' : 'none';
    });
  });
})();
</script>'''

    (BASE_DIR / "concepts.html").write_text(page, encoding='utf-8')
    print(f"\n概念库首页已生成: concepts.html")
    print(f"  MOC 领域数: {len(domains)}, 概念数: {total}")


if __name__ == "__main__":
    print("=== 构建概念库 ===")
    data = build_concept_pages()
    print(f"\n生成 {len(data)} 个概念页面")
    build_index(data)
