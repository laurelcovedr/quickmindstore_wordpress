from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
fx=json.loads((root/'locales/exchange-rates.json').read_text())
spec=(root/'commerce/IMPLEMENTATION.md').read_text()
(root/'dist/commerce-preview-data.js').write_text('window.commercePreviewData='+json.dumps({'fx':fx,'spec':spec},ensure_ascii=False).replace('<','\\u003c')+';')
