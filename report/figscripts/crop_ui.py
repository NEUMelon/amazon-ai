"""把“局势曲线”“棋谱”“算法说明”截图裁剪为右侧面板区域，便于在报告中阅读：python3 report/figscripts/crop_ui.py"""
from PIL import Image
import os
FIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'figures')
for name in ['ui_curve', 'ui_record', 'ui_about']:
    src = os.path.join(FIG, name + '.png')
    im = Image.open(src); W, H = im.size          # 1440×900 视口，2 倍像素
    box = (int(W * 0.655), int(H * 0.49), int(W * 0.96), H)
    im.crop(box).save(os.path.join(FIG, name + '_crop.png'))
    print(name, im.size, '->', box)
