"""
亚马逊棋专题检索：在 Crossref 上按关键词检索与本研究直接相关的文献，
保存标题、作者、年份、刊名、DOI，供作者筛选。检索结果本身即为可核验记录。
    python3 refs/discover_amz.py  →  refs/discovered_amz.json
"""
import json, urllib.parse, re
import verify as v
Q = [
 ('game of Amazons', None), ('Amazons game', None), ('Amazons board game', None), ('Amazons endgame', None),
 ('Amazons combinatorial game', None), ('Amazons PSPACE-complete', None), ('Monte-Carlo Amazons', None),
 ('Amazons evaluation function', None), ('Game of the Amazons', None), ('Amazons computer program', None),
 ('Amazons territory', None), ('Amazons Monte Carlo tree search', None), ('Amazons deep learning', None),
 ('Amazons UCT', None), ('Amazons alpha-beta', None), ('Amazons artificial intelligence', None),
 ('queen moves arrow game', None), ('territory games combinatorial', None), ('Konane', None), ('Clobber game', None),
 ('progressive widening Monte Carlo', None), ('progressive strategies Monte-Carlo tree search', None),
 ('Monte-Carlo evaluation cutoff', None), ('MCTS early playout termination', None), ('implicit minimax backups', None),
 ('Monte Carlo tree search heuristic evaluation function', None), ('large action space Monte Carlo tree search', None),
 ('move ordering large branching factor', None), ('forward pruning game tree', None), ('beam search game playing', None),
 ('ProbCut', None), ('selective search game tree', None), ('multi-cut pruning', None), ('late move reductions', None),
 ('game tree search high branching factor', None), ('Arimaa', None), ('Havannah Monte Carlo', None), ('Hex Monte Carlo tree search', None),
 ('Go territory evaluation', None), ('influence function Go', None), ('mobility evaluation game', None),
 ('Texel tuning evaluation', None), ('logistic regression evaluation function game', None), ('comparison training evaluation', None),
 ('Monte Carlo tree search alpha-beta comparison', None), ('MCTS versus minimax', None), ('hybrid MCTS minimax', None),
 ('Monte Carlo tree search parameter tuning', None), ('Bradley-Terry model', None), ('paired comparison ranking', None),
 ('Wilson score interval', None), ('bootstrap confidence intervals', None), ('combinatorial game theory endgame', None),
 ('cooling temperature games combinatorial', None), ('domineering game', None), ('partizan games', None),
]
out = {}
for q, cont in Q:
    params = {'query.bibliographic': q, 'rows': 40, 'select': 'DOI,title,author,issued,container-title,volume,issue,page,publisher,type,subtitle,ISBN,editor'}
    if cont: params['query.container-title'] = cont
    try:
        d = json.loads(v.get('https://api.crossref.org/works?' + urllib.parse.urlencode(params)))
    except Exception as e:
        print('ERR', q, e); continue
    n = 0
    for it in d['message']['items']:
        if it.get('type') not in ('journal-article', 'proceedings-article', 'book-chapter'): continue
        t = (it.get('title') or [''])[0]
        if not t or not it.get('author'): continue
        doi = it['DOI'].lower()
        if doi in out: continue
        yr = None
        for k in ['published-print', 'issued', 'published-online']:
            if it.get(k) and it[k].get('date-parts') and it[k]['date-parts'][0][0]: yr = it[k]['date-parts'][0][0]; break
        out[doi] = dict(doi=it['DOI'], title=re.sub(r'<[^>]+>', '', t), year=yr, query=q,
                        authors=[{'family': a.get('family') or a.get('name', ''), 'given': a.get('given', '')} for a in it['author']],
                        container=(it.get('container-title') or [''])[0], volume=it.get('volume'), issue=it.get('issue'), pages=it.get('page'),
                        publisher=it.get('publisher'), type=it.get('type'))
        n += 1
    print(q, n, flush=True)
json.dump(out, open('discovered_amz.json', 'w'), indent=1, ensure_ascii=False)
print(len(out))
