"""docx 后处理：封面、目录域、分节与页眉页脚、表格样式；随后调用 LibreOffice 更新目录并导出 PDF。"""
import os, re, copy, subprocess, time, shutil
from docx import Document
from docx.oxml.ns import qn
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
ROOT = os.path.dirname(os.path.abspath(__file__))

def el(tag, **attrs):
    e = etree.SubElement(etree.Element('dummy'), qn(tag))
    e = etree.Element(qn(tag))
    for k, v in attrs.items(): e.set(qn(k), str(v))
    return e

def run_xml(text, size=None, bold=False, color=None, font_ea=None, font_ascii=None, spacing=None):
    r = el('w:r'); rpr = etree.SubElement(r, qn('w:rPr'))
    if font_ea or font_ascii:
        f = etree.SubElement(rpr, qn('w:rFonts'))
        if font_ascii: f.set(qn('w:ascii'), font_ascii); f.set(qn('w:hAnsi'), font_ascii)
        if font_ea: f.set(qn('w:eastAsia'), font_ea)
    if bold: etree.SubElement(rpr, qn('w:b'))
    if color: c = etree.SubElement(rpr, qn('w:color')); c.set(qn('w:val'), color)
    if spacing: s = etree.SubElement(rpr, qn('w:spacing')); s.set(qn('w:val'), str(spacing))
    if size:
        s = etree.SubElement(rpr, qn('w:sz')); s.set(qn('w:val'), str(int(size * 2)))
        s = etree.SubElement(rpr, qn('w:szCs')); s.set(qn('w:val'), str(int(size * 2)))
    t = etree.SubElement(r, qn('w:t')); t.text = text; t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return r

def para(runs=(), align='center', before=0, after=0, line=None, style='Normal', keep=False):
    p = el('w:p'); ppr = etree.SubElement(p, qn('w:pPr'))
    ps = etree.SubElement(ppr, qn('w:pStyle')); ps.set(qn('w:val'), style)
    sp = etree.SubElement(ppr, qn('w:spacing')); sp.set(qn('w:before'), str(before)); sp.set(qn('w:after'), str(after))
    if line: sp.set(qn('w:line'), str(line)); sp.set(qn('w:lineRule'), 'auto')
    ind = etree.SubElement(ppr, qn('w:ind')); ind.set(qn('w:firstLine'), '0'); ind.set(qn('w:firstLineChars'), '0')
    jc = etree.SubElement(ppr, qn('w:jc')); jc.set(qn('w:val'), align)
    for r in runs: p.append(r)
    return p

def image_para_from(doc, path, width_cm):
    # 借助 python-docx 生成图片段落，再取出其 XML
    tmp = doc.add_paragraph()
    tmp.add_run().add_picture(path, width=Cm(width_cm))
    x = tmp._p
    x.getparent().remove(x)
    ppr = x.get_or_add_pPr()
    sp = etree.SubElement(ppr, qn('w:spacing')); sp.set(qn('w:line'), '240'); sp.set(qn('w:lineRule'), 'auto')
    ind = etree.SubElement(ppr, qn('w:ind')); ind.set(qn('w:firstLine'), '0')
    jc = etree.SubElement(ppr, qn('w:jc')); jc.set(qn('w:val'), 'center')
    return x

def cover(doc, title):
    els = []
    FONT_H = '黑体'; FONT_S = '宋体'
    els.append(para([], before=200))
    els.append(para([run_xml('人工智能基础导论  ·  第三次课程作业', 11, color='5B6573', font_ea=FONT_H, spacing=40)], after=500))
    els.append(para([run_xml(title, 26, bold=True, color='1F3A5F', font_ea=FONT_H)], after=120))
    els.append(para([run_xml('（人工智能算法）', 18, color='1F3A5F', font_ea=FONT_H)], after=260))
    els.append(para([run_xml('α-β 搜索、蒙特卡洛树搜索与自对弈学习的实现与比较', 12, color='3D4B5C', font_ea=FONT_S)], after=300))
    els.append(image_para_from(doc, os.path.join(ROOT, 'figures', 'cover.png'), 9.5))
    els.append(para([], after=120))
    # 信息表
    tbl = el('w:tbl')
    tpr = etree.SubElement(tbl, qn('w:tblPr'))
    tw = etree.SubElement(tpr, qn('w:tblW')); tw.set(qn('w:w'), '6200'); tw.set(qn('w:type'), 'dxa')
    jc = etree.SubElement(tpr, qn('w:jc')); jc.set(qn('w:val'), 'center')
    grid = etree.SubElement(tbl, qn('w:tblGrid'))
    for w in (1800, 4400):
        g = etree.SubElement(grid, qn('w:gridCol')); g.set(qn('w:w'), str(w))
    rows = [('课程名称', '人工智能基础导论'), ('学　　院', '信息科学与工程学院'), ('班　　级', '自动化 2405 班'), ('学　　号', '20242524'), ('姓　　名', '宋宇浩')]
    for k, v in rows:
        tr = etree.SubElement(tbl, qn('w:tr'))
        trpr = etree.SubElement(tr, qn('w:trPr')); h = etree.SubElement(trpr, qn('w:trHeight')); h.set(qn('w:val'), '560')
        for i, (txt, w) in enumerate(((k + '：', 1800), (v, 4400))):
            tc = etree.SubElement(tr, qn('w:tc')); tcpr = etree.SubElement(tc, qn('w:tcPr'))
            tcw = etree.SubElement(tcpr, qn('w:tcW')); tcw.set(qn('w:w'), str(w)); tcw.set(qn('w:type'), 'dxa')
            va = etree.SubElement(tcpr, qn('w:vAlign')); va.set(qn('w:val'), 'bottom')
            b = etree.SubElement(tcpr, qn('w:tcBorders'))
            for side in ('top', 'left', 'right', 'bottom'):
                s = etree.SubElement(b, qn(f'w:{side}'))
                if side == 'bottom' and i == 1: s.set(qn('w:val'), 'single'); s.set(qn('w:sz'), '8'); s.set(qn('w:color'), '1F2A37')
                else: s.set(qn('w:val'), 'nil')
            tc.append(para([run_xml(txt, 14, font_ea=FONT_S if i else FONT_H, bold=(i == 0))], align='right' if i == 0 else 'center', after=40))
    els.append(tbl)
    els.append(para([run_xml('2026 年 11 月', 14, font_ea=FONT_S)], before=360))
    els.append(para([run_xml('代码仓库：https://github.com/NEUMelon/amazon-ai', 10, color='3D4B5C', font_ea=FONT_S)], before=160, after=0))
    els.append(para([run_xml('在线试玩：https://neumelon.github.io/amazon-ai/', 10, color='3D4B5C', font_ea=FONT_S)], before=0))
    return els

def toc_block():
    out = []
    h = para([run_xml('目　　录')], style='TOCHeading')
    out.append(h)
    p = el('w:p')
    def fld(kind, instr=None):
        r = el('w:r')
        if kind == 'instr':
            t = etree.SubElement(r, qn('w:instrText')); t.text = instr; t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        else:
            f = etree.SubElement(r, qn('w:fldChar')); f.set(qn('w:fldCharType'), kind)
            if kind == 'begin': f.set(qn('w:dirty'), 'true')
        return r
    p.append(fld('begin')); p.append(fld('instr', ' TOC \\o "1-3" \\h \\z \\u ')); p.append(fld('separate'))
    p.append(run_xml('（目录将在导出时自动生成）')); p.append(fld('end'))
    out.append(p)
    return out

def _disp_len(t):
    return sum(2 if ord(ch) > 0x2E80 else 1 for ch in t)

def fit_columns(tbl, total=8958):
    """按单元格内容长度分配列宽（中文字符计 2），避免 pandoc 等宽分配导致首列过窄。"""
    rows = tbl.findall(qn('w:tr'))
    if not rows: return
    ncol = max(len(tr.findall(qn('w:tc'))) for tr in rows)
    if ncol < 2: return
    body = [0] * ncol; head = [0] * ncol
    for ri, tr in enumerate(rows):
        for j, tc in enumerate(tr.findall(qn('w:tc'))):
            # 每个段落单独计长，取最长的一段（单元格内的换行不计入）
            L = max([_disp_len(''.join(t.text or '' for t in p.iter(qn('w:t')))) for p in tc.findall(qn('w:p'))] or [0])
            if ri == 0: head[j] = max(head[j], L)
            else: body[j] = max(body[j], L)
    w = [max(min(b, 44), min(h, 12), 5) + 3 for b, h in zip(body, head)]
    tot = sum(w); widths = [int(total * x / tot) for x in w]
    grid = tbl.find(qn('w:tblGrid'))
    if grid is not None:
        for g in list(grid): grid.remove(g)
        for x in widths:
            g = etree.SubElement(grid, qn('w:gridCol')); g.set(qn('w:w'), str(x))
    for tr in rows:
        for j, tc in enumerate(tr.findall(qn('w:tc'))):
            if j >= ncol: break
            tcpr = tc.find(qn('w:tcPr'))
            if tcpr is None: tcpr = etree.Element(qn('w:tcPr')); tc.insert(0, tcpr)
            for old in tcpr.findall(qn('w:tcW')): tcpr.remove(old)
            tw = etree.Element(qn('w:tcW')); tw.set(qn('w:w'), str(widths[j])); tw.set(qn('w:type'), 'dxa'); tcpr.insert(0, tw)

def style_tables(doc):
    for tbl in doc.element.body.iter(qn('w:tbl')):
        tpr = tbl.find(qn('w:tblPr'))
        if tpr is None: continue
        if tbl.find('.//' + qn('w:tblStyle')) is None: continue  # 封面表格没有样式，跳过
        for old in tpr.findall(qn('w:tblBorders')): tpr.remove(old)
        bd = etree.SubElement(tpr, qn('w:tblBorders'))
        for side, sz, col in (('top', 12, '1F2A37'), ('bottom', 12, '1F2A37'), ('insideH', 4, 'C9CED6')):
            s = etree.SubElement(bd, qn(f'w:{side}')); s.set(qn('w:val'), 'single'); s.set(qn('w:sz'), str(sz)); s.set(qn('w:color'), col)
        for side in ('left', 'right', 'insideV'):
            s = etree.SubElement(bd, qn(f'w:{side}')); s.set(qn('w:val'), 'nil')
        for old in tpr.findall(qn('w:tblW')): tpr.remove(old)
        tw = etree.SubElement(tpr, qn('w:tblW')); tw.set(qn('w:w'), '5000'); tw.set(qn('w:type'), 'pct')
        jc = tpr.find(qn('w:jc'))
        if jc is None: jc = etree.SubElement(tpr, qn('w:jc'))
        jc.set(qn('w:val'), 'center')
        cm = etree.SubElement(tpr, qn('w:tblCellMar'))
        for side, v in (('top', 30), ('bottom', 30), ('left', 80), ('right', 80)):
            s = etree.SubElement(cm, qn(f'w:{side}')); s.set(qn('w:w'), str(v)); s.set(qn('w:type'), 'dxa')
        fit_columns(tbl)
        rows = tbl.findall(qn('w:tr'))
        for ri, tr in enumerate(rows):
            if ri == 0:
                trpr = tr.find(qn('w:trPr'))
                if trpr is None: trpr = etree.Element(qn('w:trPr')); tr.insert(0, trpr)
                etree.SubElement(trpr, qn('w:tblHeader'))
            for tc in tr.findall(qn('w:tc')):
                tcpr = tc.find(qn('w:tcPr'))
                if tcpr is None: tcpr = etree.Element(qn('w:tcPr')); tc.insert(0, tcpr)
                if ri == 0:
                    sh = etree.SubElement(tcpr, qn('w:shd')); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), 'EEF1F5')
                for p in tc.findall(qn('w:p')):
                    ppr = p.find(qn('w:pPr'))
                    if ppr is None: ppr = etree.Element(qn('w:pPr')); p.insert(0, ppr)
                    ps = ppr.find(qn('w:pStyle'))
                    if ps is None: ps = etree.Element(qn('w:pStyle')); ppr.insert(0, ps)
                    ps.set(qn('w:val'), 'TableHead' if ri == 0 else 'TableText')

MATH = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
def fix_math(doc):
    # 独立公式段落改用 Equation 样式（自动行距），避免固定行距把公式裁掉
    for p in doc.element.body.iter(qn('w:p')):
        if p.find('{%s}oMathPara' % MATH) is not None:
            ppr = p.find(qn('w:pPr'))
            if ppr is None: ppr = etree.Element(qn('w:pPr')); p.insert(0, ppr)
            ps = ppr.find(qn('w:pStyle'))
            if ps is None: ps = etree.Element(qn('w:pStyle')); ppr.insert(0, ps)
            ps.set(qn('w:val'), 'Equation')
        elif p.find('.//{%s}oMath' % MATH) is not None:
            # 含行内公式的正文段落：改为最小行距，防止分式等被裁切
            ppr = p.find(qn('w:pPr'))
            if ppr is None: ppr = etree.Element(qn('w:pPr')); p.insert(0, ppr)
            sp = ppr.find(qn('w:spacing'))
            if sp is None: sp = etree.SubElement(ppr, qn('w:spacing'))
            sp.set(qn('w:line'), '400'); sp.set(qn('w:lineRule'), 'atLeast')

def make_sectpr(template, fmt=None, start=None, title_pg=False):
    s = copy.deepcopy(template)
    for t in ('w:headerReference', 'w:footerReference', 'w:pgNumType', 'w:titlePg', 'w:type'):
        for x in s.findall(qn(t)): s.remove(x)
    ty = etree.Element(qn('w:type')); ty.set(qn('w:val'), 'nextPage'); s.insert(0, ty)
    if fmt:
        pn = etree.SubElement(s, qn('w:pgNumType')); pn.set(qn('w:fmt'), fmt)
        if start: pn.set(qn('w:start'), str(start))
    return s

def heading_text(p):
    return ''.join(t.text or '' for t in p.iter(qn('w:t'))).strip()

def shrink_appendix_code(doc, marker='附录E', size_half_pt=16, line=200):
    """附录 E 的完整源代码用更小的字号与行距排版，正文中的代码保持 9 磅。"""
    on = False
    for p in doc.element.body.iter(qn('w:p')):
        ppr = p.find(qn('w:pPr'))
        st = ppr.find(qn('w:pStyle')).get(qn('w:val')) if ppr is not None and ppr.find(qn('w:pStyle')) is not None else ''
        if st.startswith('Heading1') or st == 'Heading1' or st == '1':
            on = heading_text(p).replace(' ', '').replace('　', '').startswith(marker)
        if on and st == 'SourceCode':
            sp = ppr.find(qn('w:spacing'))
            if sp is None: sp = etree.SubElement(ppr, qn('w:spacing'))
            sp.set(qn('w:line'), str(line)); sp.set(qn('w:lineRule'), 'exact'); sp.set(qn('w:before'), '0'); sp.set(qn('w:after'), '60')
            for r in p.iter(qn('w:r')):
                rpr = r.find(qn('w:rPr'))
                if rpr is None: rpr = etree.Element(qn('w:rPr')); r.insert(0, rpr)
                for t in ('w:sz', 'w:szCs'):
                    for x in rpr.findall(qn(t)): rpr.remove(x)
                    e = etree.SubElement(rpr, qn(t)); e.set(qn('w:val'), str(size_half_pt))

def run(src, dst, title):
    doc = Document(src)
    body = doc.element.body
    sect_final = body.find(qn('w:sectPr'))
    # 页面设置：A4，页边距与第一次报告一致
    for tag, val in (('w:pgSz', None),):
        pass
    pgsz = sect_final.find(qn('w:pgSz')) or etree.SubElement(sect_final, qn('w:pgSz'))
    pgsz.set(qn('w:w'), '11906'); pgsz.set(qn('w:h'), '16838')
    mar = sect_final.find(qn('w:pgMar'))
    if mar is None: mar = etree.SubElement(sect_final, qn('w:pgMar'))
    for k, v in (('top', 1474), ('bottom', 1361), ('left', 1474), ('right', 1474), ('header', 851), ('footer', 794), ('gutter', 0)):
        mar.set(qn(f'w:{k}'), str(v))
    style_tables(doc)
    fix_math(doc)
    # 目录：插入到第一个编号章（“一、”）之前
    paras = list(body)
    first_ch = next(p for p in paras if p.tag == qn('w:p') and p.find('.//' + qn('w:pStyle')) is not None
                    and p.find('.//' + qn('w:pStyle')).get(qn('w:val')) == 'Heading1' and heading_text(p).startswith('一、'))
    for x in toc_block(): first_ch.addprevious(x)
    # 封面
    cv = cover(doc, title)
    first = body[0]
    for x in cv: first.addprevious(x)
    # 分节：封面一节；之后每个一级标题一节
    h1s = [p for p in body if p.tag == qn('w:p') and p.find('.//' + qn('w:pStyle')) is not None
           and p.find('.//' + qn('w:pStyle')).get(qn('w:val')) in ('Heading1', 'TOCHeading')]
    titles = [heading_text(p) for p in h1s]
    # 每个一级标题前，在前一个段落里放上一节的 sectPr
    sect_info = []   # (sectPr 元素, 页码格式, 起始页, 页眉右侧文字)
    prev_title = None
    front = True
    for i, h in enumerate(h1s):
        prev = h.getprevious()
        holder = para([], after=0)
        h.addprevious(holder)
        if i == 0:
            sp = make_sectpr(sect_final)     # 封面
            info = (None, None, None)
        else:
            t_prev = titles[i - 1]
            is_front = not re.match(r'^[一二三四五六七八九十]、', t_prev) and not t_prev.startswith('参考文献') and not t_prev.startswith('附录')
            fmt = 'upperRoman' if is_front else 'decimal'
            start = 1 if i == 1 else (1 if (titles[i - 1].startswith('一、')) else None)
            sp = make_sectpr(sect_final, fmt, start)
            info = (fmt, start, t_prev)
        holder.find(qn('w:pPr')).append(sp)
        sect_info.append(info)
    # 最后一节
    t_last = titles[-1]
    for x in sect_final.findall(qn('w:pgNumType')): sect_final.remove(x)
    pn = etree.SubElement(sect_final, qn('w:pgNumType')); pn.set(qn('w:fmt'), 'decimal')
    sect_info.append(('decimal', None, t_last))
    doc.save(dst)
    # 页眉页脚
    doc = Document(dst)
    secs = doc.sections
    assert len(secs) == len(sect_info), (len(secs), len(sect_info))
    for s, (fmt, start, htxt) in zip(secs, sect_info):
        s.header.is_linked_to_previous = False
        s.footer.is_linked_to_previous = False
        hp = s.header.paragraphs[0]; fp = s.footer.paragraphs[0]
        for p in (hp, fp):
            for r in list(p.runs): r._r.getparent().remove(r._r)
        if htxt is None:
            continue
        hp.style = doc.styles['Normal']
        pf = hp.paragraph_format; pf.first_line_indent = Cm(0)
        # 右对齐制表位 + 底边线
        ppr = hp._p.get_or_add_pPr()
        tabs = etree.SubElement(ppr, qn('w:tabs')); tb = etree.SubElement(tabs, qn('w:tab')); tb.set(qn('w:val'), 'right'); tb.set(qn('w:pos'), '8958')
        bdr = etree.SubElement(ppr, qn('w:pBdr')); bt = etree.SubElement(bdr, qn('w:bottom'))
        bt.set(qn('w:val'), 'single'); bt.set(qn('w:sz'), '4'); bt.set(qn('w:color'), '9AA3AF'); bt.set(qn('w:space'), '4')
        for txt in (title, '\t' + htxt):
            r = hp.add_run(txt); r.font.size = Pt(9); r.font.color.rgb = RGBColor(0x5B, 0x65, 0x73)
            r._r.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.paragraph_format.first_line_indent = Cm(0)
        r = fp.add_run()
        for kind, instr in (('begin', None), (None, ' PAGE '), ('end', None)):
            if kind:
                f = etree.SubElement(r._r, qn('w:fldChar')); f.set(qn('w:fldCharType'), kind)
            else:
                t = etree.SubElement(r._r, qn('w:instrText')); t.text = instr
        r.font.size = Pt(10.5)
    shrink_appendix_code(doc)
    doc.save(dst)
    lo_update(dst)

def lo_update(path):
    """用 LibreOffice（UNO）打开文档，更新目录与域，保存 docx 并导出 PDF。"""
    script = os.path.join(ROOT, 'lo_update.py')
    subprocess.run(['python3', script, path], check=True)
