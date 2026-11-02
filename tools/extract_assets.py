from pathlib import Path
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
out = root / 'miniprogram' / 'assets'
out.mkdir(parents=True, exist_ok=True)
psd = PSDImage.open(root / 'H5问答1.psd')
flat = psd.topil()
flat.crop((0, 0, 1080, 352)).save(out / 'survey-header.png', optimize=True)
flat.crop((0, 0, 1080, 180)).save(out / 'brand-strip.png', optimize=True)
flat.crop((0, 3378, 1080, 3928)).save(out / 'survey-footer.jpg', quality=94)
psd = PSDImage.open(root / 'H5问答3.psd')
psd.topil().save(out / 'success-reference.jpg', quality=94)
for layer in psd:
    layer.visible = layer.name in ('背景', '组 3')
psd.composite(force=True).convert('RGB').save(out / 'success-bg.jpg', quality=94)
print('PSD assets exported:', out)
