import sys,types,os,json
from pathlib import Path
sys.path.insert(0,'test-artifacts/manual-entry-door-recovery/python-deps')
ns={};source=Path('scripts/audit-local-door-selections-readonly.py').read_text(encoding='utf-8-sig');exec(source[:source.index('latest={}')],ns)
sys.modules['snappy']=types.SimpleNamespace(decompress=ns['snappy'])
import compression.zstd
sys.modules['zstd']=types.SimpleNamespace(decompress=compression.zstd.decompress)
from dfindexeddb.leveldb import record as level
from dfindexeddb.indexeddb.chromium import record as chrome
folder=Path(os.environ['LOCALAPPDATA'])/'Google/Chrome/User Data/Profile 6/IndexedDB/http_localhost_3000.indexeddb.leveldb'
report=[]
for raw in level.FolderReader(folder).GetRecords(use_manifest=True):
 try:
  rec=chrome.ChromiumIndexedDBRecord.FromLevelDBRecord(raw,parse_value=False,load_blobs=False)
  key=str(rec.key)
  if rec.object_store_id==0 or rec.MatchesKey('03-09/123') or rec.MatchesKey('Johnson'):
   value=rec.key.ParseValue(raw.record.value) if raw.record.record_type else None
   item={'key':key,'sequence':rec.sequence_number,'databaseId':rec.database_id,'storeId':rec.object_store_id,'value':str(value)[:3000]}
   report.append(item)
 except Exception as e:report.append({'error':str(e)})
p=Path('test-artifacts/manual-entry-door-recovery/indexeddb-metadata-audit.json');p.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
