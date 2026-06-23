#!/usr/bin/env python3
"""
前三排 · 学习小组 — 静态网站构建脚本
读取 raw/01-articles/前三排/txt/ 目录下的所有 TXT 文件，
为每篇文章生成独立的 HTML 页面，并生成 index.html 首页。
"""

import os
import re
import html
import json
from pathlib import Path
from datetime import datetime

# ============ 配置 ============
BASE_DIR = Path(__file__).parent  # docs/
RAW_TXT_DIR = BASE_DIR.parent / "raw" / "01-articles" / "前三排" / "txt"
RAW_PDF_DIR = BASE_DIR.parent / "raw" / "01-articles" / "前三排" / "pdf"
RAW_AUDIO_DIR = BASE_DIR.parent / "raw" / "01-articles" / "前三排" / "audio"
ARTICLES_DIR = BASE_DIR / "articles"
PDF_DIR = BASE_DIR / "pdf"
AUDIO_DIR = BASE_DIR / "audio"
INDEX_FILE = BASE_DIR / "index.html"

# ============ 文件名解析 ============

def parse_filename(filename: str) -> dict:
    """
    解析文件名，提取日期、类型、标题。
    支持格式:
      - 2025.08.01小结：标题.txt
      - 2025.08.03主题1：标题.txt
      - 2025.08.30【长文】标题.txt
      - 2025.09.30 标题.txt
      - 2026.03.27 【分享】标题.txt
      - 2025.09.04：标题.txt
      - 2025.11.23 标题.txt
    """
    name = filename.replace('.txt', '').strip()

    result = {
        'date': '',
        'date_display': '',
        'type': 'article',
        'type_cn': '文章',
        'title': name,
        'timestamp': 0,
    }

    # 尝试匹配日期前缀: YYYY.MM.DD 或 YYYYMMDD (day 支持1-2位)
    date_match = re.match(r'(\d{4})\.(\d{2})\.(\d{1,2})', name)
    if date_match:
        y, m, d = date_match.group(1), date_match.group(2), date_match.group(3)
        result['date'] = f"{y}-{m}-{d.zfill(2)}"
        result['date_display'] = f"{y}年{m}月{int(d)}日"
        remaining = name[date_match.end():].strip()
    else:
        # 尝试 YYYYMMDD 格式
        date_match = re.match(r'(\d{4})(\d{2})(\d{2})', name)
        if date_match:
            y, m, d = date_match.group(1), date_match.group(2), date_match.group(3)
            result['date'] = f"{y}-{m}-{d}"
            result['date_display'] = f"{y}年{m}月{d}日"
            remaining = name[date_match.end():].strip()
        else:
            remaining = name

    # 提取类型标签
    type_patterns = [
        (r'^小结[：:]', 'summary', '小结'),
        (r'^主题\d*[：:]', 'topic', '主题'),
        (r'^【长文】', 'longform', '长文'),
        (r'^【长文分享】', 'longform', '长文分享'),
        (r'^【分享】', 'share', '分享'),
        (r'^案例名称[：:_]', 'case', '案例'),
        (r'^案例名称_?《?', 'case', '案例'),
        (r'^小结[：:]\s*《?', 'summary', '小结'),
    ]

    for pattern, type_key, type_cn in type_patterns:
        m = re.match(pattern, remaining)
        if m:
            result['type'] = type_key
            result['type_cn'] = type_cn
            remaining = remaining[m.end():].strip()
            break
    else:
        # 尝试匹配 "主题分享"、"分享" 等无日期前缀的情况
        if '小结' in remaining[:4]:
            result['type'] = 'summary'
            result['type_cn'] = '小结'
            remaining = re.sub(r'^小结[：:]?\s*', '', remaining)
        elif '主题' in remaining[:4]:
            result['type'] = 'topic'
            result['type_cn'] = '主题'
            remaining = re.sub(r'^主题\d*[：:]?\s*', '', remaining)

    # 清理标题
    title = remaining.strip()
    # 移除尾部的 (1), (2) 等编号
    title = re.sub(r'\s*[\(（]\d+[\)）]\s*$', '', title)
    # 移除尾部的标点清理
    title = title.rstrip('：:。，,、 ')

    if not title:
        title = name

    result['title'] = title

    # 生成 timestamp 用于排序
    if result['date']:
        try:
            dt = datetime.strptime(result['date'], '%Y-%m-%d')
            result['timestamp'] = dt.timestamp()
        except:
            pass

    return result


def generate_slug(parsed: dict, filename: str) -> str:
    """生成文章文件名（不含扩展名）"""
    base = filename.replace('.txt', '')
    # 清理文件名中的特殊字符
    safe = base.replace(' ', '_').replace('：', '_').replace('？', '_').replace('，', '_')
    safe = re.sub(r'[<>:"/\\|?*《》「」『』【】()（）]', '', safe)
    return safe[:80]  # 限制长度


def read_article_text(filepath: Path) -> str:
    """读取文章内容，返回纯文本"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
    except UnicodeDecodeError:
        with open(filepath, 'r', encoding='gbk') as f:
            text = f.read()
    return text.strip()


def text_to_html_paragraphs(text: str) -> str:
    """将纯文本转换为 HTML 段落"""
    lines = text.split('\n')
    paragraphs = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过纯分隔线
        if re.match(r'^[_\-\*]{3,}$', line):
            continue
        # HTML 转义
        line = html.escape(line)
        paragraphs.append(f'    <p>{line}</p>')

    return '\n'.join(paragraphs)


def get_excerpt(text: str, max_chars: int = 120) -> str:
    """获取文章摘要"""
    # 取第一个非空段落
    lines = [l.strip() for l in text.split('\n') if l.strip() and not re.match(r'^[_\-\*]{3,}$', l.strip())]
    if lines:
        excerpt = lines[0]
        if len(excerpt) > max_chars:
            excerpt = excerpt[:max_chars] + '…'
        return html.escape(excerpt)
    return ''


def classify_tags(title: str) -> list:
    """根据标题自动分类标签"""
    tags = []
    title_lower = title

    # 关键词匹配
    keywords = {
        '职场': ['职场', '升职', '公司', '工作', '领导', '同事', '体制内', '体制外', '外企', '国企', '空降', '管理', '上班', '老板', '打工', '加班', '内卷', '躺平', '大厂', '年薪', '项目'],
        '情感': ['爱', '恋', '婚', '情', '男友', '女友', '老公', '老婆', '妻子', '丈夫', '夫妻', '分手', '绝交', '暧昧', '约会', '相亲', '彩礼', '赘婿', '去父留子'],
        '原生家庭': ['父母', '父亲', '母亲', '妈妈', '爸爸', '公婆', '女儿', '儿子', '孩子', '家庭', '原生', '亲子', '母女', '父子', '代孕'],
        '思维方法': ['思维', '方法', '逻辑', '一阶', '二阶', '三阶', '辩证', '唯物主义', 'ORID', '模型', '系统', '规律', '举一反三', '成长', '习惯', '闭环', '飞轮', '定位'],
        '社会': ['社会', '女权', '阶层', '消费主义', '历史', '文化', '政治', '国家', '法律', '体制', '自由', '权力', '资本', '金融', '经济', '财富'],
        '心理': ['心理', '焦虑', '抑郁', '自我攻击', 'PUA', '人格', '讨好', 'ADHD', '习得性无助', '内耗', '精神', '情绪', '创伤'],
    }

    for tag, words in keywords.items():
        for w in words:
            if w in title_lower:
                tags.append(tag)
                break

    return tags if tags else ['其他']


# ============ HTML 模板 ============

HTML_HEAD = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — 前三排 · 学习小组</title>
  <link rel="stylesheet" href="{css_path}style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>'''

SITE_HEADER = '''
<header class="site-header">
  <div class="site-title"><span class="accent">前三排</span> · 学习小组</div>
  <div class="site-subtitle">历史内容整理 · 存档阅览</div>
</header>'''

SITE_FOOTER = '''
<footer class="site-footer">
  <p>前三排 · 学习小组 — 历史存档站点</p>
  <p>由 <a href="https://github.com/djw565/qiansanpai">github.com/djw565/qiansanpai</a> 维护</p>
</footer>
</body>
</html>'''


def build_article_page(parsed: dict, slug: str, html_body: str):
    """生成单篇文章的 HTML 页面"""
    tags = classify_tags(parsed['title'])
    tags_html = ' '.join(f'<span class="article-type {parsed["type"]}">{parsed["type_cn"]}</span>' +
                         ''.join(f'<span class="article-type">{t}</span>' for t in tags))

    content = f'''{HTML_HEAD.format(title=html.escape(parsed["title"]), css_path="../css/")}
{SITE_HEADER}

<main class="article-page">
  <a href="../index.html" class="back-link">← 返回目录</a>

  <article>
    <header class="article-header">
      <div class="article-date-full">{parsed["date_display"]}</div>
      <h1>{html.escape(parsed["title"])}</h1>
      <div class="article-meta">
        {tags_html}
      </div>
    </header>

    <div class="article-body">
{html_body}
    </div>
  </article>
</main>

{SITE_FOOTER}'''

    filepath = ARTICLES_DIR / f"{slug}.html"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath


def build_index_page(articles: list):
    """生成首页 index.html"""
    # 统计
    total = len(articles)
    years = {}
    for a in articles:
        y = a['date'][:4] if a['date'] else '未分类'
        if y not in years:
            years[y] = 0
        years[y] += 1

    stats_html = f'''
    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-number">{total}</div>
        <div class="stat-label">篇文章</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">2025-2026</div>
        <div class="stat-label">时间跨度</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{len(years)}</div>
        <div class="stat-label">年份</div>
      </div>
    </div>'''

    # 按年份分组
    articles_by_year = {}
    for a in articles:
        y = a['date'][:4] if a['date'] else '未分类'
        if y not in articles_by_year:
            articles_by_year[y] = []
        articles_by_year[y].append(a)

    # 年份从新到旧排序
    sorted_years = sorted(articles_by_year.keys(), reverse=True)

    year_sections = []
    for year in sorted_years:
        year_articles = articles_by_year[year]
        year_articles.sort(key=lambda a: a['timestamp'], reverse=True)

        cards = []
        for a in year_articles:
            tags = a.get('tags', classify_tags(a['title']))
            tags_html = ' '.join(f'<span class="article-type">{t}</span>' for t in tags[:2])

            excerpt = a.get('excerpt', '')
            excerpt_html = f'<div class="article-excerpt">{excerpt}</div>' if excerpt else ''

            # PDF 和 TXT 的链接路径不同
            if a['type'] == 'pdf':
                href = a['slug']  # pdf/filename.pdf
                link_icon = ' 📄'
            else:
                href = f"articles/{a['slug']}.html"
                link_icon = ''

            card = f'''      <a href="{href}" class="article-card"{' target="_blank"' if a['type'] == 'pdf' else ''}>
        <div class="article-meta">
          <span class="article-date">{a['date_display']}</span>
          <span class="article-type {a['type']}">{a['type_cn']}</span>
          {tags_html}
        </div>
        <div class="article-title">{html.escape(a['title'])}{link_icon}</div>
        {excerpt_html}
      </a>'''
            cards.append(card)

        year_section = f'''    <section class="year-section">
      <h2 class="year-heading">{year} 年 <span class="count">({len(year_articles)} 篇)</span></h2>
{chr(10).join(cards)}
    </section>'''
        year_sections.append(year_section)

    content = f'''{HTML_HEAD.format(title="首页", css_path="css/")}
{SITE_HEADER}

<nav class="nav-bar">
  <div class="filter-tags">
    <a href="#" class="filter-tag active" data-filter="all">全部</a>
    <a href="#" class="filter-tag" data-filter="职场">职场</a>
    <a href="#" class="filter-tag" data-filter="情感">情感</a>
    <a href="#" class="filter-tag" data-filter="原生家庭">原生家庭</a>
    <a href="#" class="filter-tag" data-filter="思维方法">思维方法</a>
    <a href="#" class="filter-tag" data-filter="心理">心理</a>
    <a href="#" class="filter-tag" data-filter="社会">社会</a>
    <a href="#" class="filter-tag" data-filter="PDF案例">PDF案例</a>
  </div>
</nav>

<main class="main-content">
  <div id="daily-quote" class="daily-quote">
    <div class="daily-quote-label">✦ 随机金句</div>
    <div class="daily-quote-text" id="quote-text">加载中...</div>
    <div class="daily-quote-source" id="quote-source"></div>
  </div>
  <div class="search-container">
    <span class="search-icon">&#x1F50D;</span>
    <input type="text" id="search-input" class="search-input" placeholder="搜索文章标题、关键词..." autocomplete="off">
  </div>
  {stats_html}
{chr(10).join(year_sections)}
</main>

<script src="js/daily-quote.js"></script>
<script src="js/search.js"></script>
{SITE_FOOTER}'''

    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        f.write(content)


def parse_pdf_filename(filename: str) -> dict:
    """
    解析 PDF 文件名，提取日期、标题。
    支持格式:
      - 2025.10.12案例名称：标题.pdf
      - 2025.10.31 主题分享：标题.pdf
      - 20250628标题.pdf
      - 冻卵与代孕.pdf (无日期)
    """
    name = filename.replace('.pdf', '').strip()

    result = {
        'date': '',
        'date_display': '',
        'type': 'pdf',
        'type_cn': 'PDF案例',
        'title': name,
        'timestamp': 0,
    }

    # 尝试匹配日期前缀
    date_match = re.match(r'(\d{4})\.(\d{2})\.(\d{1,2})', name)
    if date_match:
        y, m, d = date_match.group(1), date_match.group(2), date_match.group(3)
        result['date'] = f"{y}-{m}-{d.zfill(2)}"
        result['date_display'] = f"{y}年{m}月{int(d)}日"
        remaining = name[date_match.end():].strip()
    else:
        date_match = re.match(r'(\d{4})(\d{2})(\d{2})', name)
        if date_match:
            y, m, d = date_match.group(1), date_match.group(2), date_match.group(3)
            result['date'] = f"{y}-{m}-{d}"
            result['date_display'] = f"{y}年{m}月{d}日"
            remaining = name[date_match.end():].strip()
        else:
            remaining = name

    # 提取类型标签
    for prefix in ['案例名称', '案例名称_', '案例名称：', '案例名称_《']:
        if remaining.startswith(prefix):
            remaining = remaining[len(prefix):]
            break

    # 清理标记
    remaining = re.sub(r'[：:]\s*', '：', remaining)
    remaining = remaining.strip('_ 《》「」')
    # 移除尾部编号
    remaining = re.sub(r'\s*[\(（]\d+[\)）]\s*$', '', remaining)
    # 移除尾部随机字符串
    remaining = re.sub(r'-[a-f0-9]{6,}$', '', remaining)
    remaining = remaining.rstrip('：:。，,、 _-')

    if remaining:
        result['title'] = remaining

    # 生成 timestamp
    if result['date']:
        try:
            dt = datetime.strptime(result['date'], '%Y-%m-%d')
            result['timestamp'] = dt.timestamp()
        except:
            pass

    return result

def main():
    print("=" * 60)
    print("  前三排 · 学习小组 — 静态网站构建")
    print("=" * 60)

    # 确保目录存在
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)

    # 收集所有 TXT 文件（跳过模板文件）
    txt_files = sorted([f for f in RAW_TXT_DIR.glob("*.txt") if not f.name.startswith("模板")])
    print(f"\n[OK] 找到 {len(txt_files)} 个 TXT 文件")

    articles = []
    success = 0
    errors = []

    for txt_file in txt_files:
        try:
            parsed = parse_filename(txt_file.name)
            slug = generate_slug(parsed, txt_file.name)

            # 读取文章内容
            text = read_article_text(txt_file)
            html_body = text_to_html_paragraphs(text)
            excerpt = get_excerpt(text)

            # 生成文章页面
            build_article_page(parsed, slug, html_body)

            articles.append({
                **parsed,
                'slug': slug,
                'excerpt': excerpt,
                'filename': txt_file.name,
                'tags': classify_tags(parsed['title']),
                'char_count': len(text),
            })

            success += 1
            print(f"  [OK] {parsed['date']} | {parsed['title'][:40]}")

        except Exception as e:
            errors.append((txt_file.name, str(e)))
            print(f"  [ERR] {txt_file.name}: {e}")

    # ===== 处理 PDF 文件 =====
    pdf_files = sorted(PDF_DIR.glob("*.pdf")) if PDF_DIR.exists() else []
    print(f"\n[OK] 找到 {len(pdf_files)} 个 PDF 文件")

    for pdf_file in pdf_files:
        try:
            parsed = parse_pdf_filename(pdf_file.name)
            pdf_tags = classify_tags(parsed['title'])
            if 'PDF案例' not in pdf_tags:
                pdf_tags.append('PDF案例')
            articles.append({
                **parsed,
                'slug': 'pdf/' + pdf_file.name,  # 直接链接到PDF
                'excerpt': 'PDF 案例文档 — 点击下载或在线查看',
                'filename': pdf_file.name,
                'tags': pdf_tags,
                'char_count': 0,
            })
            print(f"  [PDF] {parsed['date']} | {parsed['title'][:40]}")
        except Exception as e:
            errors.append((pdf_file.name, str(e)))
            print(f"  [ERR] {pdf_file.name}: {e}")

    # 按日期排序（新 → 旧）
    articles.sort(key=lambda a: a['timestamp'], reverse=True)

    # 生成首页
    build_index_page(articles)
    print(f"\n[HOME] 首页已生成: {INDEX_FILE}")

    # 生成 articles.json 数据文件
    json_data = []
    for a in articles:
        json_data.append({
            'date': a['date'],
            'date_display': a['date_display'],
            'title': a['title'],
            'type': a['type'],
            'type_cn': a['type_cn'],
            'slug': a['slug'],
            'tags': a['tags'],
            'excerpt': a.get('excerpt', ''),
        })

    json_path = BASE_DIR / "articles.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"[DATA] 数据文件已生成: {json_path}")

    # 统计报告
    print(f"\n{'=' * 60}")
    print(f"  构建完成! 成功: {success}/{len(txt_files)}")
    if errors:
        print(f"  失败: {len(errors)} 个文件")
        for name, err in errors:
            print(f"    - {name}: {err}")

    # 类型统计
    type_counts = {}
    for a in articles:
        t = a['type_cn']
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"\n  类型分布:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c} 篇")

    # 标签统计
    tag_counts = {}
    for a in articles:
        for t in a['tags']:
            tag_counts[t] = tag_counts.get(t, 0) + 1
    print(f"\n  标签分布:")
    for t, c in sorted(tag_counts.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c} 篇")

    print(f"\n  总字数: {sum(a['char_count'] for a in articles):,} 字")
    print(f"{'=' * 60}")

    return articles


if __name__ == "__main__":
    main()
