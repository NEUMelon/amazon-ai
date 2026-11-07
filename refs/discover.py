"""
专题检索：在 Crossref 上按关键词检索与本研究直接相关的文献（期刊/会议论文），
保存标题、作者、年份、刊名、DOI 与摘要（若有），供作者人工筛选。检索结果本身即为可核验记录。
"""
import json, urllib.parse, re, sys
import verify as v
Q = [
 ('gomoku', None), ('gomoku artificial intelligence', None), ('five-in-a-row game', None), ('renju', None), ('connect6', None),
 ('k-in-a-row games', None), ('connect-four solved', None), ('threat-space search', None), ('proof-number search', None),
 ('depth-first proof-number search', None), ('alpha-beta search game tree', 'ICGA Journal'), ('transposition table', 'ICGA Journal'),
 ('move ordering heuristic', None), ('iterative deepening alpha-beta', None), ('principal variation search', None),
 ('Monte-Carlo tree search', 'ICGA Journal'), ('Monte Carlo tree search', 'IEEE Transactions on Computational Intelligence and AI in Games'),
 ('Monte Carlo tree search', 'IEEE Transactions on Games'), ('upper confidence bounds trees', None), ('progressive widening', None),
 ('rapid action value estimation', None), ('MCTS solver', None), ('computer Go Monte-Carlo', None), ('game of Hex search', None),
 ('Othello evaluation function learning', None), ('evaluation function tuning games', None), ('self-play reinforcement learning board game', None),
 ('AlphaZero', None), ('Elo rating system', None), ('game tree search', 'Artificial Intelligence'), ('Monte Carlo tree search', 'Lecture Notes in Computer Science'),
 ('playout policy Monte-Carlo', None), ('simulation balancing', None), ('nested rollout policy adaptation', None), ('general game playing', None),
 ('minimax search pathology', None), ('quiescence search', None), ('null move pruning', None), ('opening book', 'ICGA Journal'),
 ('Lines of Action Monte-Carlo', None), ('Amazons game search', None), ('shogi evaluation', None), ('chinese chess computer', None),
 ('board game neural network policy', None), ('Monte Carlo tree search survey', None), ('combinatorial game theory', None),
]
out = {}
for q, cont in Q:
    params = {'query.bibliographic': q, 'rows': 60, 'select': 'DOI,title,author,issued,container-title,volume,issue,page,publisher,type,abstract,subtitle,ISBN,editor'}
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
                        publisher=it.get('publisher'), type=it.get('type'), abstract=re.sub(r'<[^>]+>', ' ', it.get('abstract', ''))[:1200])
        n += 1
    print(q, cont, n)
json.dump(out, open('discovered.json', 'w'), indent=1, ensure_ascii=False)
print(len(out))
