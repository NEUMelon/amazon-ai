"""
报告构建脚本：Markdown 章节 → 预处理（编号、引用、交叉引用）→ pandoc → docx 后处理 → LibreOffice 更新目录并导出 PDF
    python3 report/build.py
产物：report/out/人工智能导论第三次报告_宋宇浩_20242524.docx / .pdf
"""
import os, re, json, subprocess, sys, copy, shutil
from lxml import etree

ROOT = os.path.dirname(os.path.abspath(__file__))
CH = os.path.join(ROOT, 'chapters')
OUT = os.path.join(ROOT, 'out')
BUILD = os.path.join(ROOT, 'build')
os.makedirs(OUT, exist_ok=True)
REF = json.load(open(os.path.join(ROOT, '..', 'refs', 'verified.json'), encoding='utf8'))
TITLE = '亚马逊棋博弈搜索算法研究报告'
BASENAME = '人工智能导论第三次报告_宋宇浩_20242524'

ORDER = sorted(f for f in os.listdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chapters')) if f.endswith('.md'))
CN_NUM = '一二三四五六七八九十'

# ---------------------------------------------------------------- 文献格式（GB/T 7714—2015 顺序编码制）
BOOK_PUBLISHER = {  # 图书出版者：OpenLibrary 返回的首个出版者可能是重印或译本，这里按原版核对后指定
    'russell2020': ('Hoboken', 'Pearson'), 'sutton2018': ('Cambridge, MA', 'MIT Press'), 'bishop2006': ('New York', 'Springer'),
    'goodfellow2016': ('Cambridge, MA', 'MIT Press'), 'hastie2009': ('New York', 'Springer'), 'efron1993': ('New York', 'Chapman & Hall'),
    'knuth1998': ('Reading, MA', 'Addison-Wesley'), 'nilsson1980': ('Palo Alto', 'Tioga'), 'berlekamp2001': ('Natick, MA', 'A K Peters'),
    'elo1978': ('New York', 'Arco'), 'luce1959': ('New York', 'Wiley'), 'cohen1995': ('Cambridge, MA', 'MIT Press'),
    'munzner2014': ('Boca Raton', 'CRC Press'), 'neumann1944': ('Princeton', 'Princeton University Press'), 'lattimore2020': ('Cambridge', 'Cambridge University Press'),
    'nocedal2006': ('New York', 'Springer'), 'beck2008': ('Cambridge', 'Cambridge University Press'), 'hearn2009': ('Wellesley, MA', 'A K Peters'),
    'gumbel1954': ('Washington, DC', 'U.S. Government Printing Office'), 'yannakakis2018': ('Cham', 'Springer'), 'mandziuk2010': ('Berlin', 'Springer'),
    'millington2019': ('Boca Raton', 'CRC Press'),
}
YEAR_FIX = {'cr_boskovicNone_466': 2006, 'cr_kendallNone_467': 2001}

def clean(s):
    s = re.sub(r'<[^>]+>', '', s or '')
    s = s.replace('&amp;#x03B1;&amp;#x03B2;', 'αβ').replace('&amp;lt;/br&amp;gt;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    s = s.replace('&atilde;', 'ã').replace('&oacute;', 'ó')
    s = re.sub(r'\s+', ' ', s).strip()
    if s.isupper() and len(s) > 8:  # 全大写标题转为首字母大写
        s = s.capitalize()
    return s

def fmt_author(a):
    fam = clean(a.get('family') or '')
    giv = clean(a.get('given') or '')
    if re.search(r'[一-鿿]', fam): return fam + giv
    if not giv: return fam.upper() if fam else ''
    ini = ' '.join(p[0].upper() for p in re.split(r'[\s\-.]+', giv) if p and p[0].isalpha())
    return f'{fam.upper()} {ini}'.strip()

def fmt_authors(lst):
    lst = [x for x in (lst or []) if (x.get('family') or x.get('given'))]
    if not lst: return ''
    names = [fmt_author(a) for a in lst[:3]]
    s = ', '.join(names)
    if len(lst) > 3: s += ', et al'
    return s

def fmt_ref(key):
    r = REF[key]
    au = fmt_authors(r.get('authors')) or fmt_authors(r.get('editors'))
    t = clean(r.get('title'))
    y = r.get('year') or YEAR_FIX.get(key)
    src, typ = r.get('source'), r.get('type')
    cont = clean(r.get('container') or '')
    vol, iss, pg = r.get('volume'), r.get('issue'), r.get('pages')
    doi = r.get('doi')
    pre = (au + '. ') if au else ''
    tail = ''
    if doi: tail = f' DOI: {doi}.'
    if src == 'arxiv':
        return f'{pre}{t}[EB/OL]. arXiv: {r["arxiv"]}, {y}. https://arxiv.org/abs/{r["arxiv"]}.' + (f' DOI: {doi}.' if doi else '')
    if src == 'neurips':
        return f'{pre}{t}[C]//Advances in Neural Information Processing Systems. {y}. {r["url"]}.'
    if src == 'url':
        return f'{pre}{t}[J]. {cont}, {y}, {vol}: {pg}. {r["url"]}.'
    if src == 'openlibrary' or (typ in ('book', 'monograph', 'edited-book', 'reference-book') ):
        place, pub = BOOK_PUBLISHER.get(key, (None, clean(r.get('publisher') or '')))
        pp = f'{place}: {pub}' if place else pub
        return f'{pre}{t}[M]. {pp}, {y}.' + tail
    if typ == 'proceedings-article':
        s = f'{pre}{t}[C]//{cont}. ' + (f'{clean(r.get("publisher"))}, ' if r.get('publisher') else '') + f'{y}'
        if pg: s += f': {pg}'
        return s + '.' + tail
    if typ == 'book-chapter':
        s = f'{pre}{t}[M]//{cont}. ' + (f'{clean(r.get("publisher"))}, ' if r.get('publisher') else '') + f'{y}'
        if pg: s += f': {pg}'
        return s + '.' + tail
    # 期刊
    s = f'{pre}{t}[J]. {cont}, {y}'
    if vol: s += f', {vol}'
    if iss: s += f'({iss})'
    if pg: s += f': {pg}'
    return s + '.' + tail

# ---------------------------------------------------------------- 预处理
def compress(nums):
    nums = sorted(set(nums)); out = []; i = 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1: j += 1
        if j - i >= 2: out.append(f'{nums[i]}–{nums[j]}')
        else: out.extend(str(n) for n in nums[i:j + 1])
        i = j + 1
    return ','.join(out)

def preprocess(texts):
    labels = {}          # 'fig:x' -> '2-3'
    cite_order = []      # 按首次出现排序的文献键
    # 第一遍：编号
    out_files = []
    for fname, txt in texts:
        lines = txt.split('\n'); res = []
        out_files.append((fname, res))
        for ln in lines:
            res.append(ln)
    # 编号遍历（章、节、图、表、式）
    chap = None; sec = sub = 0; cnt = {'fig': 0, 'tab': 0, 'eq': 0, 'lst': 0}
    processed = []
    for fname, lines in out_files:
        newl = []
        in_code = False
        for ln in lines:
            if ln.startswith('```'): in_code = not in_code; newl.append(ln); continue
            if in_code: newl.append(ln); continue
            m = re.match(r'^(#{1,3}) (.*?)\s*(\{-\})?\s*$', ln)
            if m:
                lev, text, unnum = len(m.group(1)), m.group(2), m.group(3)
                if lev == 1:
                    mm = re.match(r'^([一二三四五六七八九十])、', text)
                    ma = re.match(r'^附录([A-Z])', text)
                    if mm: chap = str(CN_NUM.index(mm.group(1)) + 1)
                    elif ma: chap = ma.group(1)
                    else: chap = None
                    sec = sub = 0; cnt = {k: 0 for k in cnt}
                    newl.append(f'# {text}'); continue
                if unnum or chap is None: newl.append(f'{"#" * lev} {text}'); continue
                if lev == 2: sec += 1; sub = 0; newl.append(f'## {chap}.{sec}　{text}'); continue
                if lev == 3: sub += 1; newl.append(f'### {chap}.{sec}.{sub}　{text}'); continue
            for kind in ('fig', 'tab', 'lst'):
                mm = re.match(rf'^::{kind} (\S+)', ln)
                if mm:
                    cnt[kind] += 1
                    labels[f'{kind}:{mm.group(1)}'] = f'{chap}-{cnt[kind]}'
            for mm in re.finditer(r'\{#eq:([\w-]+)\}', ln):
                cnt['eq'] += 1
                labels[f'eq:{mm.group(1)}'] = f'{chap}-{cnt["eq"]}'
            newl.append(ln)
        processed.append((fname, newl))
    # 第二遍：展开
    final = []
    for fname, lines in processed:
        buf = []
        in_code = False
        for ln in lines:
            if ln.startswith('```'): in_code = not in_code; buf.append(ln); continue
            if in_code: buf.append(ln); continue
            m = re.match(r'^::fig (\S+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*(?:\|\s*(.*?))?\s*(?:\|\s*([\d.]+))?\s*$', ln)
            if m:
                fid, path, cap, note, width = m.groups()
                w = width or '15.5'
                num = labels[f'fig:{fid}']
                buf += ['', '::: {custom-style="FigurePara"}', f'![]({path}){{width={w}cm}}', ':::', '',
                        '::: {custom-style="FigCap"}', f'**图 {num}**　{cap}', ':::', '']
                if note: buf += ['::: {custom-style="FigNote"}', f'注：{note}', ':::', '']
                continue
            m = re.match(r'^::tab (\S+)\s*\|\s*(.*)$', ln)
            if m:
                num = labels[f'tab:{m.group(1)}']
                buf += ['', '::: {custom-style="TblCap"}', f'**表 {num}**　{m.group(2).strip()}', ':::', '']
                continue
            m = re.match(r'^::lst (\S+)\s*\|\s*(.*)$', ln)
            if m:
                num = labels[f'lst:{m.group(1)}']
                buf += ['', '::: {custom-style="TblCap"}', f'**代码 {num}**　{m.group(2).strip()}', ':::', '']
                continue
            m = re.match(r'^::note (.*)$', ln)
            if m:
                buf += ['', '::: {custom-style="TblNote"}', m.group(1).strip(), ':::', '']
                continue
            m = re.match(r'^::lead (.*)$', ln)
            if m:
                buf += ['', '::: {custom-style="ChapterLead"}', m.group(1).strip(), ':::', '']
                continue
            m = re.match(r'^::box (.*?)\s*\|\s*(.*)$', ln)
            if m:
                buf += ['', '::: {custom-style="BoxTitle"}', m.group(1), ':::', '', '::: {custom-style="BoxText"}', m.group(2), ':::', '']
                continue
            # 公式编号
            def eqrep(mm):
                return f'\\qquad\\qquad ({labels["eq:" + mm.group(2)].replace("-", chr(92) + "text{-}")})$$'
            ln = re.sub(r'(\$\$)\s*\{#eq:([\w-]+)\}', lambda mm: '', ln) if False else ln
            ln = re.sub(r'\$\$\s*\{#eq:([\w-]+)\}', lambda mm: f'\\qquad \\text{{({labels["eq:" + mm.group(1)]})}}$$', ln)
            # 交叉引用
            ln = re.sub(r'@(fig|tab|eq|lst):([\w-]+)', lambda mm: labels.get(f'{mm.group(1)}:{mm.group(2)}', '??' + mm.group(2)), ln)
            # 文献引用 [@a; @b]
            def citerep(mm):
                keys = [k.strip().lstrip('@') for k in mm.group(1).split(';')]
                nums = []
                for k in keys:
                    if k not in REF: raise SystemExit(f'unknown ref {k} in {fname}')
                    if REF[k]['status'] != 'verified': raise SystemExit(f'unverified ref cited: {k}')
                    if k not in cite_order: cite_order.append(k)
                    nums.append(cite_order.index(k) + 1)
                return '^\\[' + compress(nums) + '\\]^'
            ln = re.sub(r'\[(@[^\]]+)\]', citerep, ln)
            buf.append(ln)
        final.append((fname, '\n'.join(buf)))
    return final, labels, cite_order

def expand_includes(txt):
    """::include 相对 report/ 的 Markdown 片段；::src 源文件 起始行 结束行 —— 直接从源代码文件截取（保证代码清单与实际代码一致）"""
    out = []
    for ln in txt.split('\n'):
        m = re.match(r'^::include (\S+)\s*$', ln)
        if m:
            out.append(expand_includes(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), m.group(1)), encoding='utf8').read().rstrip())); continue  # 允许嵌套包含
        m = re.match(r'^::src (\S+) (\d+) (\d+)\s*$', ln)
        if m:
            path = os.path.join(os.path.dirname(ROOT), m.group(1)); a, b = int(m.group(2)), int(m.group(3))
            lines = open(path, encoding='utf8').read().split('\n')[a - 1:b]
            lang = {'js': 'js', 'py': 'python', 'html': 'html', 'css': 'css'}.get(path.rsplit('.', 1)[-1], 'text')
            out.append('```' + lang); out.extend(lines); out.append('```'); continue
        out.append(ln)
    return '\n'.join(out)

def main():
    texts = []
    for f in ORDER:
        p = os.path.join(CH, f)
        if os.path.exists(p): texts.append((f, expand_includes(open(p, encoding='utf8').read())))
    final, labels, cites = preprocess(texts)
    parts = []
    for fname, txt in final:
        if fname == '07_refs.md':
            txt += '\n\n' + '\n\n'.join(f'::: {{custom-style="RefEntry"}}\n\\[{i + 1}\\] {fmt_ref(k)}\n:::' for i, k in enumerate(cites))
        parts.append(txt)
    md = '\n\n'.join(parts)
    md = md.replace('{{REFCOUNT}}', str(len(cites)))
    open(os.path.join(BUILD, 'all.md'), 'w', encoding='utf8').write(md)
    json.dump(dict(labels=labels, cites=cites), open(os.path.join(BUILD, 'labels.json'), 'w'), ensure_ascii=False, indent=1)
    body = os.path.join(BUILD, 'body.docx')
    subprocess.run(['pandoc', os.path.join(BUILD, 'all.md'), '-f', 'markdown+superscript+pipe_tables+tex_math_dollars', '-o', body,
                    '--reference-doc', os.path.join(BUILD, 'reference.docx'), '--resource-path', ROOT, '--highlight-style', 'tango'], check=True)
    import postprocess
    final_docx = os.path.join(OUT, BASENAME + '.docx')
    postprocess.run(body, final_docx, TITLE)
    print('cited refs:', len(cites))

if __name__ == '__main__':
    sys.path.insert(0, ROOT)
    main()
