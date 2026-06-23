#!/usr/bin/env python3
"""
从所有 TXT 文章中自动提取金句，输出到 quotes.json
改进版：大幅收紧筛选标准，只保留真正有洞察力的精炼语句
"""
import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
RAW_TXT_DIR = BASE_DIR.parent / "raw" / "01-articles" / "前三排" / "txt"
OUTPUT_FILE = BASE_DIR / "quotes.json"


def is_good_quote(text: str) -> bool:
    """严格判断一句话是否适合作为金句"""
    text = text.strip()
    L = len(text)

    # ===== 第1关：硬过滤 =====

    # 长度：20-65个字（太短没内容，太长不适合卡片展示）
    if L < 20 or L > 65:
        return False

    # 包含特定噪音词的直接排除
    noise_words = [
        '（读评论', '（读题主', '（读弹幕',
        '子休', '题主', '嘉宾',
        '【', '】', '——', '________________________________',
        '这个问题', '这道题', '这个案例', '这个情况', '这个事',
        '刚才', '刚刚', '接下来', '下面', '首先', '接下来我们',
        '第一步', '第二步', '第三步', '第一点', '第二点',
        '第一个模块', '第二个模块', '总结一下', '小结一下',
        '不清楚', '不知道啊', '不确定', '不好说',
        '对吧', '是吧', '懂吗', '明白吗', '晓得吧',
        '是不是这个', '有没有可能', '怎么说呢',
        '哈哈哈哈', '哈哈哈', '呵呵',
        '真不是', '真没', '真有',
        '说白了', '说句不好听', '说白了就是',
        '就这么', '就这', '就那',
        'OK', 'ok', 'Ok',
        '会不会得罪', '会不会被封', '会不会被',  # 元评论
        '今天不会又', '不会又给我',
        '比如', '举例', '打个比方',
        '怎么看', '什么意思', '为什么',
    ]
    for w in noise_words:
        if w in text:
            return False

    # 包含案例特征的排除：日期、金额、具体人名
    case_patterns = [
        r'\d{4}年\d{1,2}月',            # 2024年3月
        r'\d+万',                         # 50万
        r'\d+块',                         # 9000块
        r'\d+岁',                         # 35岁
        r'[某某][某某]',                  # 马某某、张某某
        r'题主.{0,5}说',                  # 题主说...
        r'我.{0,3}老公',                  # 我老公/我老婆
        r'我.{0,3}妈',                    # 我妈
        r'我.{0,3}爸',                    # 我爸
        r'他.{0,3}妈',                    # 他妈
        r'我.{0,3}领导',                  # 我领导
        r'我们公司',                      # 具体案例
        r'我们组',                        # 具体案例
        r'我们部门',                      # 具体案例
        r'孙杰', r'小刘', r'苗某',        # 案例具体人名
        r'老公.{0,5}打死',                # 案例暴力情节
        r'打死',                          # 案例暴力情节
    ]
    for pat in case_patterns:
        if re.search(pat, text):
            return False

    # 以弱词开头 → 排除
    weak_starts = [
        r'^[一二三四五六七八九]是',  # 一是/二是/三是（列举）
        r'^第[一二三四五六七八九\d]',  # 第一/第二
        r'^所以', r'^然后', r'^但是', r'^因为', r'^而且', r'^或者',
        r'^就是', r'^就是说', r'^也就是说', r'^换句话说',
        r'^你看', r'^你想', r'^你想想', r'^你们想',
        r'^好，', r'^好吧', r'^好的', r'^嗯',
        r'^其实', r'^其实呢', r'^当然', r'^当然啦',
        r'^这个', r'^那个', r'^这些', r'^那些',
        r'^我的', r'^我觉得', r'^我认为', r'^我感觉',
        r'^有个', r'^有一些', r'^有一种',
        r'^总之', r'^反正', r'^话说', r'^话说回来',
        r'^回过头', r'^回过头来', r'^最后',
        r'^再', r'^另外', r'^另外呢', r'^还有', r'^还有呢',
        r'^同学们', r'^各位', r'^大家',
        r'^可能', r'^也许', r'^大概',
        r'^不是', r'^不是说', r'^并不是',
        r'^很多人', r'^有些人', r'^不少人',
        r'^这就', r'^这不', r'^那就',
        r'^从', r'^在', r'^把', r'^被', r'^让',
    ]
    for pat in weak_starts:
        if re.match(pat, text):
            return False

    # 问句过多 → 排除
    question_marks = text.count('？') + text.count('?')
    if question_marks >= 2:
        return False
    if question_marks == 1 and text.endswith(('？', '?')):
        # 允许结尾的问句（设问/反问可以有力），但不能是弱问
        weak_questions = ['怎么', '为什么', '什么', '啥', '谁', '哪儿']
        if any(text.startswith(w) for w in weak_questions):
            return False

    # 太多逗号 → 结构松散
    if text.count('，') > 4:
        return False

    # emoji / 特殊符号开头 → 排除
    if any(0x1F300 <= ord(c) <= 0x1FAFF for c in text[:2]):
        return False

    # 重复口吃式表达 → 排除（同一句话里同一个5字+片段出现两次）
    words = text.replace('，', ' ').replace('。', ' ').split()
    for i, w in enumerate(words):
        if len(w) >= 4 and w in words[i+1:]:
            return False

    # ===== 第2关：质量评分 =====

    score = 0

    # 高品质模式 — 每种加不同分
    high_quality = [
        # 对比/辩证（3分）
        (r'不是.{1,10}而是', 3),
        (r'没有.{1,10}只有', 3),
        (r'既要.{1,10}又要', 3),
        (r'不是.{1,15}就是', 3),
        # 定义性判断（3分）
        (r'才是.{1,20}(的|$)', 3),
        (r'(本质|核心|关键).{0,5}(是|在于)', 3),
        (r'(真正|最终|终极).{0,5}(是|在于)', 3),
        (r'(唯一|一切|所有).{1,10}(是|都)', 3),
        # 绝对真理（2分）
        (r'从来不', 2),
        (r'永远不', 2),
        (r'任何.{1,5}都', 2),
        (r'不可能.{1,10}除非', 2),
        # 深刻洞察（2分）
        (r'最大的.{1,5}(是|不是)', 2),
        (r'最可怕的.{1,5}(是|不是)', 2),
        (r'问题的.{0,5}(本质|关键|核心)', 2),
        # 人生哲理（1分）
        (r'人生.{1,5}(是|不是|就是|在于)', 1),
        (r'(成长|改变|突破|蜕变).{0,3}(是|在于)', 1),
        (r'(时间|命运|机会|机遇).{0,5}(是|在于|不会)', 1),
        # 行动智慧（1分）
        (r'(不要|别).{1,10}(而|要|因为)', 1),
        (r'先.{1,10}(再|然后)', 1),
        (r'(做|干|行动).{0,3}就', 1),
        # 结构美感（1分）
        (r'.{5}，.{5}，.{5}', 1),          # 排比
        (r'(不是|没有).{3,}，(而是|只有).{3,}', 1),  # 对照
    ]

    for pat, points in high_quality:
        if re.search(pat, text):
            score += points

    # ===== 第3关：加分项（修辞质量） =====

    # 好的结尾：有力度、有韵味的收束
    good_endings = [
        r'而已[。！]?$', r'罢了[。！]?$',
        r'才是[。！]?$', r'就是[。！]?$',
        r'之道[。！]?$', r'之路[。！]?$',
    ]
    for pat in good_endings:
        if re.search(pat, text):
            score += 1

    # 用词有文采
    elegant_words = ['蛰伏', '水涨船高', '飞龙在天', '实事求是',
                     '知行合一', '以身入局', '举一反三', '触类旁通',
                     '未雨绸缪', '居安思危', '厚积薄发']
    for w in elegant_words:
        if w in text:
            score += 1

    # 需要至少 2 分
    return score >= 2


def extract_quotes_from_file(filepath: Path) -> list:
    """从单篇文章中提取金句"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
    except:
        return []

    paragraphs = re.split(r'\n\s*\n', text)
    quotes = []

    for para in paragraphs:
        lines = [l.strip() for l in para.split('\n') if l.strip()]
        for line in lines:
            if re.match(r'^[_-]{3,}$', line):
                continue
            if len(line) < 10:
                continue
            if is_good_quote(line):
                quotes.append(line.strip())

    return quotes


def main():
    print("=== 金句提取（严格模式）===")
    txt_files = sorted([f for f in RAW_TXT_DIR.glob("*.txt") if not f.name.startswith("模板")])

    all_quotes = []
    seen = set()

    for txt_file in txt_files:
        try:
            quotes = extract_quotes_from_file(txt_file)
            for q in quotes:
                if q not in seen:
                    seen.add(q)
                    all_quotes.append(q)
        except Exception as e:
            print(f"  [SKIP] {txt_file.name}: {e}")

    all_quotes.sort()

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_quotes, f, ensure_ascii=False, indent=2)

    print(f"\n提取完成: {len(all_quotes)} 条金句")

    if all_quotes:
        print("\n样例金句:")
        import random
        for q in random.sample(all_quotes, min(8, len(all_quotes))):
            print(f"  「{q}」")


if __name__ == "__main__":
    main()
