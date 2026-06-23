#!/usr/bin/env python3
"""
从所有 TXT 文章中自动提取金句，输出到 quotes.json
"""
import re
import json
import html
from pathlib import Path

BASE_DIR = Path(__file__).parent
RAW_TXT_DIR = BASE_DIR.parent / "raw" / "01-articles" / "前三排" / "txt"
OUTPUT_FILE = BASE_DIR / "quotes.json"


def is_good_quote(text: str) -> bool:
    """判断一句话是否适合作为金句"""
    text = text.strip()

    # 长度过滤：15-80 个字符
    length = len(text)
    if length < 15 or length > 80:
        return False

    # 排除这些模式
    exclude_patterns = [
        r'^[一二三四五六七八九十]、',  # 编号开头
        r'^[\(（][\d一二三][\)）]',    # (1) 开头
        r'^\d+[\.、]',                # 1. 开头
        r'^[a-zA-Z]\.',               # A. 开头
        r'^[a-zA-Z]是',                # A是... (ABC 代号)
        r'^第[一二三四五六七八九十\d]',  # "第一..."
        r'^所以',                      # 解释性
        r'^然后',                      # 叙事性
        r'^但是',                      # 转折
        r'^因为',                      # 解释性
        r'^比如说',                    # 举例
        r'^比如说，',
        r'^就是',                      # 太口语
        r'^你看',                      # 对话
        r'^你想',                      # 对话
        r'^说一下',                    # 对话
        r'^我们来',                    # 对话
        r'^当然',                      # 让步
        r'^嗯',                        # 语气词
        r'^好，',
        r'^好吧',
        r'^我们',                      # 太宽泛
        r'^这个',                      # 太口语
        r'^其实',                      # 开始解释
        r'^比如',
        r'^什么是',                    # 设问
        r'^有没有',                    # 设问
        r'^是不是',                    # 设问
        r'^怎么',                      # 设问
        r'^什么意思',                  # 设问
        r'^________________________________________',  # 分隔线
        r'^[_-]{3,}',                  # 分隔线
        r'^同学们',                    # 对话
        r'^我的',                      # 太个人
        r'^我[以认觉想]',              # 主观
        r'^你[可以会要想]',            # 第二人称
        r'^这个题',                    # 题目相关
        r'^这个案',                    # 案例相关
        r'^这道题',                    # 题目相关
        r'^回过头',                    # 叙事的
        r'^话说回来',                  # 叙事的
        r'^最后',                      # 结尾
    ]

    for pat in exclude_patterns:
        if re.match(pat, text):
            return False

    # 加分条件：这些模式让句子更像金句
    bonus_patterns = [
        r'不是.*而是',         # 对比
        r'真正.*是',           # 定义
        r'永远',               # 绝对
        r'所有.*都是',         # 概括
        r'唯一',               # 强调
        r'本质',               # 深刻
        r'关键是',             # 要点
        r'最重要的是',         # 要点
        r'核心',               # 要点
        r'——',                 # 破折号 = 警句
        r'没有.*只有',         # 对比
        r'既要.*又要',         # 对比
        r'不是.*就是',         # 对比
        r'也许.*但',           # 转折
        r'从来',               # 强调
        r'所有',               # 概括
        r'一切',               # 概括
        r'才是',               # 判断
        r'必须',               # 强调
        r'才能',               # 条件
        r'不要',               # 劝诫
        r'人生',               # 哲理
        r'命运',               # 哲理
        r'时间',               # 哲理
        r'成长',               # 哲理
        r'改变',               # 哲理
        r'选择',               # 哲理
        r'坚持',               # 励志
        r'努力',               # 励志
        r'勇气',               # 励志
        r'害怕',               # 心理学
        r'限制',               # 心理学
    ]

    score = 0
    for pat in bonus_patterns:
        if re.search(pat, text):
            score += 1

    # 需要至少命中1个加分项
    return score >= 1


def extract_quotes_from_file(filepath: Path) -> list:
    """从单篇文章中提取金句"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
    except:
        return []

    # 按段落分割（空行分隔）
    paragraphs = re.split(r'\n\s*\n', text)
    quotes = []

    for para in paragraphs:
        # 清理
        lines = [l.strip() for l in para.split('\n') if l.strip()]
        for line in lines:
            # 跳过分隔线和空行
            if re.match(r'^[_-]{3,}$', line):
                continue
            if len(line) < 5:
                continue

            # 判断是否适合当金句
            if is_good_quote(line):
                # 清洗文本
                clean = html.escape(line.strip())
                quotes.append(clean)

    return quotes


def main():
    print("=== 金句提取 ===")
    txt_files = sorted([f for f in RAW_TXT_DIR.glob("*.txt") if not f.name.startswith("模板")])

    all_quotes = []
    seen = set()

    for txt_file in txt_files:
        try:
            quotes = extract_quotes_from_file(txt_file)
            for q in quotes:
                if q not in seen and len(q) >= 15:
                    seen.add(q)
                    all_quotes.append(q)
        except Exception as e:
            print(f"  [SKIP] {txt_file.name}: {e}")

    # 去重排序
    all_quotes.sort()

    # 保存
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_quotes, f, ensure_ascii=False, indent=2)

    print(f"\n提取完成: {len(all_quotes)} 条金句")
    print(f"输出文件: {OUTPUT_FILE}")

    # 打印几条样例
    if all_quotes:
        print("\n样例金句:")
        import random
        for q in random.sample(all_quotes, min(5, len(all_quotes))):
            print(f"  「{q}」")


if __name__ == "__main__":
    main()
