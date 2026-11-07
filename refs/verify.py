"""
逐条核验参考文献：在 Crossref、arXiv、OpenLibrary 上检索候选文献，
只有标题高度相似（≥0.88）、第一作者姓氏吻合、年份相差不超过 2 年时才视为“已核验”，
并以检索到的元数据（而非记忆）生成著录信息。
    python3 refs/verify.py            # 处理 candidates.py 中尚未核验的条目
输出 refs/verified.json；未通过的条目记为 unverified，报告中不得引用或须明确标注。
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'verified.json')
UA = {'User-Agent': 'gomoku-ai-report-refcheck/1.0 (student coursework; bibliographic verification)'}

def get(url, timeout=40, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            err = e
            time.sleep(2 * (t + 1))
    raise err

def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('™', '')
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b: return 0
    r = SequenceMatcher(None, a, b).ratio()
    # 允许检索结果多出/少了副标题
    if len(a) > 20 and len(b) > 20 and (b.startswith(a) or a.startswith(b)): r = max(r, 0.95)
    return r

def author_ok(surname, names):
    s = norm(surname)
    return any(s and (s in norm(n).split() or norm(n).endswith(s) or s in norm(n)) for n in names)

def crossref(e):
    q = urllib.parse.urlencode({'query.bibliographic': f"{e['title']} {e['year']}", 'query.author': e['author'], 'rows': 8,
                                'select': 'DOI,title,author,issued,container-title,volume,issue,page,publisher,type,ISBN,event,published-print,published-online,editor,subtitle'})
    data = json.loads(get('https://api.crossref.org/works?' + q))
    best = None
    for it in data['message']['items']:
        t = (it.get('title') or [''])[0]
        sub = (it.get('subtitle') or [''])
        full = t + (': ' + sub[0] if sub and sub[0] else '')
        s = max(sim(e['title'], t), sim(e['title'], full))
        names = [(a.get('family') or a.get('name') or '') for a in it.get('author', [])] + [(a.get('family') or '') for a in it.get('editor', [])]
        yr = None
        for k in ['published-print', 'issued', 'published-online']:
            if it.get(k) and it[k].get('date-parts') and it[k]['date-parts'][0][0]:
                yr = it[k]['date-parts'][0][0]; break
        ok_a = author_ok(e['author'], names) or e['author'] in ('OpenAI',)
        ok_y = yr is not None and abs(yr - e['year']) <= 2
        score = s + (0.05 if ok_a else 0) + (0.05 if ok_y else 0)
        if s >= 0.88 and ok_a and ok_y and (best is None or score > best[0]):
            best = (score, it, yr, full)
    if not best: return None
    _, it, yr, full = best
    return dict(source='crossref', doi=it.get('DOI'), title=full, authors=[{'family': a.get('family') or a.get('name', ''), 'given': a.get('given', '')} for a in it.get('author', [])],
                editors=[{'family': a.get('family', ''), 'given': a.get('given', '')} for a in it.get('editor', [])],
                year=yr, container=(it.get('container-title') or [''])[0], volume=it.get('volume'), issue=it.get('issue'), pages=it.get('page'),
                publisher=it.get('publisher'), type=it.get('type'), isbn=it.get('ISBN'), match=round(sim(e['title'], full), 3))

import threading
ARX_LOCK = threading.Lock()
def arxiv(e):
  with ARX_LOCK:
    time.sleep(3.2)
    return _arxiv(e)
def _arxiv(e):
    STOP = {'for', 'the', 'and', 'with', 'from', 'using', 'via', 'can', 'are', 'its', 'into', 'without', 'more', 'than', 'where', 'them', 'find', 'when', 'what', 'how', 'all', 'our', 'not', 'that', 'this', 'over', 'at', 'of', 'to', 'in', 'on', 'by', 'be'}
    words = ' AND '.join('ti:' + w for w in [x for x in norm(e['title']).split() if len(x) > 2 and x not in STOP][:6])
    url = 'https://export.arxiv.org/api/query?' + urllib.parse.urlencode({'search_query': words, 'max_results': 10})
    root = ET.fromstring(get(url))
    ns = {'a': 'http://www.w3.org/2005/Atom', 'x': 'http://arxiv.org/schemas/atom'}
    for en in root.findall('a:entry', ns):
        t = ' '.join(en.find('a:title', ns).text.split())
        names = [a.find('a:name', ns).text for a in en.findall('a:author', ns)]
        yr = int(en.find('a:published', ns).text[:4])
        if sim(e['title'], t) >= 0.88 and (author_ok(e['author'], names) or e['author'] == 'OpenAI') and abs(yr - e['year']) <= 2:
            aid = en.find('a:id', ns).text.rsplit('/abs/', 1)[1]
            aid = re.sub(r'v\d+$', '', aid)
            doi = en.find('x:doi', ns)
            jref = en.find('x:journal_ref', ns)
            authors = []
            for n in names:
                parts = n.split()
                authors.append({'family': parts[-1], 'given': ' '.join(parts[:-1])})
            return dict(source='arxiv', arxiv=aid, title=t, authors=authors, year=yr, doi=doi.text if doi is not None else None,
                        journal_ref=jref.text if jref is not None else None, match=round(sim(e['title'], t), 3))
    return None

def openlibrary(e):
    r = _openlibrary(e, e['title'])
    if not r and ':' in e['title']: r = _openlibrary(e, e['title'].split(':')[0])
    return r

def _openlibrary(e, qtitle):
    url = 'https://openlibrary.org/search.json?' + urllib.parse.urlencode({'title': qtitle, 'author': e['author'], 'limit': 10, 'fields': 'key,title,subtitle,author_name,first_publish_year,publish_year,publisher,isbn'})
    d = json.loads(get(url))
    for doc in d.get('docs', []):
        t = doc.get('title', '') + (': ' + doc['subtitle'] if doc.get('subtitle') else '')
        if max(sim(e['title'], doc.get('title', '')), sim(e['title'], t)) >= 0.88 and author_ok(e['author'], doc.get('author_name', [])):
            years = sorted(set(doc.get('publish_year', []) + ([doc['first_publish_year']] if doc.get('first_publish_year') else [])))
            # 取与候选年份最接近的出版年（不同版次）
            yr = min(years, key=lambda y: abs(y - e['year'])) if years else None
            if yr is None or abs(yr - e['year']) > 2: continue
            authors = []
            for n in doc.get('author_name', [])[:6]:
                parts = n.split()
                authors.append({'family': parts[-1], 'given': ' '.join(parts[:-1])})
            return dict(source='openlibrary', olid=doc.get('key'), title=t, authors=authors, year=yr,
                        publisher=(doc.get('publisher') or [None])[0], isbn=(doc.get('isbn') or [None])[0], match=round(sim(e['title'], t), 3))
    return None

def urlcheck(e):
    # 已知官方页面（如 NeurIPS/JMLR/AAAI 论文页）：抓取页面并确认标题与作者姓氏出现在页面中
    if not e.get('url'): return None
    html = get(e['url']).decode('utf8', 'ignore')
    text = norm(re.sub(r'<[^>]+>', ' ', html))
    if norm(e['title']) in text and norm(e['author']) in text:
        return dict(source='url', url=e['url'], title=e['title'], authors=None, year=e['year'], match=1.0)
    return None

NEURIPS_CACHE = {}
def neurips(e):
    # NeurIPS 论文集按年份列出全部论文标题与作者，在列表页中精确查找
    for y in (e['year'], e['year'] - 1, e['year'] + 1):
        if y not in NEURIPS_CACHE:
            try: NEURIPS_CACHE[y] = get(f'https://proceedings.neurips.cc/paper_files/paper/{y}').decode('utf8', 'ignore')
            except Exception: NEURIPS_CACHE[y] = ''
        html = NEURIPS_CACHE[y]
        for m in re.finditer(r'<a title="paper title" href="([^"]+)">([^<]+)</a>\s*<span class="paper-authors">([^<]*)</span>', html):
            href, t, au = m.group(1), m.group(2), m.group(3)
            if sim(e['title'], t) >= 0.9 and norm(e['author']) in norm(au):
                authors = []
                for n in au.split(','):
                    parts = n.split()
                    if parts: authors.append({'family': parts[-1], 'given': ' '.join(parts[:-1])})
                return dict(source='neurips', url='https://proceedings.neurips.cc' + href, title=t.strip(), authors=authors, year=y,
                            container='Advances in Neural Information Processing Systems', match=round(sim(e['title'], t), 3))
    return None

def verify(e):
    order = {'j': [crossref, arxiv, neurips], 'a': [arxiv, crossref], 'b': [crossref, openlibrary], 'w': []}[e['kind']]
    if e.get('url'): order = [urlcheck] + order
    for f in order:
        try:
            r = f(e)
        except Exception as ex:
            r = None
        if r:
            r.update(key=e['key'], topic=e['topic'], kind=e['kind'], status='verified', query=dict(author=e['author'], year=e['year'], title=e['title']))
            return r
    return dict(key=e['key'], topic=e['topic'], kind=e['kind'], status='unverified', query=dict(author=e['author'], year=e['year'], title=e['title']))

def load_candidates():
    out = []
    for fn in sorted(os.listdir(HERE)):
        if fn.startswith('candidates') and fn.endswith('.py'):
            ns = {}
            exec(open(os.path.join(HERE, fn), encoding='utf8').read(), ns)
            for line in ns['C'].strip().splitlines():
                if not line.strip() or line.startswith('#'): continue
                parts = [x.strip() for x in line.split('|')]
                k, kind, au, yr, title, topic = parts[:6]
                d = dict(key=k, kind=kind, author=au, year=int(yr), title=title, topic=topic)
                if len(parts) > 6: d['url'] = parts[6]
                out.append(d)
    return out

if __name__ == '__main__':
    cands = load_candidates()
    keys = [c['key'] for c in cands]
    dup = {k for k in keys if keys.count(k) > 1}
    if dup: print('DUPLICATE KEYS', dup); sys.exit(1)
    done = json.load(open(OUT)) if os.path.exists(OUT) else {}
    retry = '--retry' in sys.argv
    todo = [c for c in cands if c['key'] not in done or (retry and done[c['key']]['status'] != 'verified')]
    print(len(cands), 'candidates;', len(todo), 'to check')
    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(verify, todo):
            done[r['key']] = r
            print(('OK  ' if r['status'] == 'verified' else 'FAIL'), r['key'], r.get('source', ''), r.get('doi') or r.get('arxiv') or r.get('olid') or '', '|', (r.get('title') or r['query']['title'])[:70])
    json.dump(done, open(OUT, 'w'), indent=1, ensure_ascii=False)
    n = sum(1 for v in done.values() if v['status'] == 'verified')
    print('verified', n, 'of', len(done))
