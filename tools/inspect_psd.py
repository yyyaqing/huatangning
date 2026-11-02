from pathlib import Path
from psd_tools import PSDImage
import json

root = Path(__file__).resolve().parents[1]
out = root / 'design'
out.mkdir(exist_ok=True)
for path in root.glob('*.psd'):
    psd = PSDImage.open(path)
    psd.topil().save(out / (path.stem + '.png'))
    layers = []
    def walk(group, depth=0):
        for layer in group:
            item = {'name':layer.name, 'kind':layer.kind, 'visible':layer.visible, 'bbox':list(layer.bbox), 'depth':depth}
            if layer.kind == 'type':
                item['text'] = layer.text
            layers.append(item)
            if layer.is_group(): walk(layer, depth+1)
    walk(psd)
    (out / (path.stem + '.json')).write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding='utf-8')
    print(path.name, psd.size)
    for i in layers:
        print('  '*i['depth'], i['name'], i['kind'], i['bbox'], repr(i.get('text','')))
