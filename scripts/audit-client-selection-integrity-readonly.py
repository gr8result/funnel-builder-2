import sys,json,types,hashlib
from pathlib import Path
sys.path.insert(0,'artifacts/test-artifacts/manual-entry-door-recovery/python-deps')
ns={};source=Path('scripts/audit-local-door-selections-readonly.py').read_text(encoding='utf-8-sig');source=source.replace('32*1024*1024','1024*1024*1024').replace('for _ in range(n):o.append(o[-off])','o.extend((o[-off:] * ((n+off-1)//off))[:n])');exec(source[:source.index('latest={}')],ns)
sys.modules['snappy']=types.SimpleNamespace(decompress=ns['snappy'])
import compression.zstd
sys.modules['zstd']=types.SimpleNamespace(decompress=compression.zstd.decompress)
from dfindexeddb.indexeddb.chromium import blink,v8
from dfindexeddb.indexeddb import types as js
v8.ValueDeserializer.LATEST_VERSION=16
def plain(v):
 if isinstance(v,js.JSArray):return [plain(v.properties.get(i,v.properties.get(str(i),x))) for i,x in enumerate(v.values)]
 if isinstance(v,dict):return {str(k):plain(x) for k,x in v.items()}
 if isinstance(v,(str,int,float,bool)) or v is None:return v
 return None

out=Path('recovery/client-selection-integrity-2026-10-09/audit');out.mkdir(exist_ok=True)
root=out.parent/'browser/Profile 6/IndexedDB/http_localhost_3000.indexeddb.blob/1/01'
for name in ['144','142','141','143']:
 try:
  raw=blink.V8ScriptValueDecoder.FromBytes((root/name).read_bytes());data=plain(raw)
  wb=data.get('workbook') or data.get('payload') or data.get('data') or data
  if isinstance(wb,dict) and wb.get('workbook'):wb=wb['workbook']
  report={'blob':name,'recordKeys':list(data),'recordKey':data.get('key'),'savedAt':data.get('savedAt'),'workbookKeys':list(wb) if isinstance(wb,dict) else str(type(wb))}
  (out/f'blob-{name}.json').write_text(json.dumps(data),encoding='utf-8')
  print(json.dumps(report),flush=True)
 except Exception as e:print(name,str(e),flush=True)
