from pathlib import Path
import json, re, copy, hashlib, datetime

run = Path(__file__).resolve().parent
base_hash = 'ecce3e98270a9041b071e3c627090b228cfaab8a34e6c847296bd775baac3a74'
assert hashlib.sha256((run/'scene-contract.json').read_bytes()).hexdigest() == base_hash
chapter = json.loads((run/'chapter-common-trace-patch.json').read_text())
cinema_text = (run/'cinema-common-trace-clarification.md').read_text()
cinema = json.loads(re.search(r'```json\s*\n([\s\S]*?)\n```', cinema_text).group(1))
assert cinema['reviewedContractSha256'] == base_hash
sources = {}
originals = {}
changes = []

def source(name):
    assert Path(name).name == name and name in {'scene-contract.json','scene-cinema-lane.json','story-intent.md','cinematography-treatment.md'}, name
    if name not in sources:
        originals[name] = (run/name).read_bytes()
        sources[name] = json.loads(originals[name]) if name.endswith('.json') else originals[name].decode()
    return sources[name]

def locate(document, pointer):
    parts = [part.replace('~1','/').replace('~0','~') for part in pointer.split('/')[1:]]
    assert parts
    current = document
    for part in parts[:-1]:
        current = current[int(part)] if isinstance(current,list) else current[part]
    key = parts[-1]
    return current, (int(key) if isinstance(current,list) and key != '-' else key)

for packet, author in [(chapter,'Chapter'),(cinema,'Cinematography')]:
    for entry in packet.get('changes',[]):
        document = source(entry['file'])
        for operation in entry['operations']:
            parent,key = locate(document,operation['path'])
            op,value = operation['op'],operation['value']
            if op == 'test':
                assert parent[key] == value, (author,entry['file'],operation['path'],'old value mismatch')
            elif op == 'replace':
                assert key in parent if isinstance(parent,dict) else 0 <= key < len(parent)
                parent[key] = copy.deepcopy(value)
                changes.append({'author':author,'file':entry['file'],'path':operation['path'],'op':op})
            elif op == 'add':
                if isinstance(parent,list):
                    if key == '-': parent.append(copy.deepcopy(value))
                    else: parent.insert(key,copy.deepcopy(value))
                else:
                    assert key not in parent, (entry['file'],operation['path'],'add would overwrite')
                    parent[key] = copy.deepcopy(value)
                changes.append({'author':author,'file':entry['file'],'path':operation['path'],'op':op})
            else: raise ValueError(op)
    for entry in packet.get('textChanges',[]):
        text = source(entry['file'])
        count = text.count(entry['old'])
        assert count == entry.get('expectedCount',1),(author,entry['file'],'text replacement count',count)
        sources[entry['file']] = text.replace(entry['old'],entry['new'])
        changes.append({'author':author,'file':entry['file'],'textReplacement':entry['old']})

contract = source('scene-contract.json')
contract['contractVersion'] = 'scene-v2'
contract['supersedesVersion'] = 'scene-v1'
contract['production']['frozenAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
lock = json.loads((run/'production-lock.json').read_text())
for key in ['allowedPaths','protectedPaths']:
    contract['production'][key] = lock[key]

out = run/'staging/scene-v2/assembled'
out.mkdir(parents=True,exist_ok=True)
bytes_by_name = {}
for name,value in sources.items():
    if name != 'scene-contract.json':
        bytes_by_name[name] = (json.dumps(value,indent=2)+'\n').encode() if isinstance(value,dict) else value.encode()

refs = contract['production']['authorityRefs']
for index,ref in enumerate(refs):
    if '#sha256=' not in ref: continue
    name,_ = ref.split('#sha256=',1)
    if Path(name).name != name: continue
    data = bytes_by_name.get(name)
    if data is None and (run/name).is_file(): data=(run/name).read_bytes()
    if data is not None: refs[index] = name+'#sha256='+hashlib.sha256(data).hexdigest()
for name in ['chapter-common-trace-clarification.md','chapter-common-trace-patch.json','cinema-common-trace-clarification.md','producer-v2-decision.json','producer-boundary-completion.json']:
    assert (run/name).is_file(), name
    ref=name+'#sha256='+hashlib.sha256((run/name).read_bytes()).hexdigest()
    if ref not in refs: refs.append(ref)
bytes_by_name['scene-contract.json'] = (json.dumps(contract,indent=2)+'\n').encode()
for name,data in bytes_by_name.items(): (out/name).write_bytes(data)
record = {'baseContractSha256':base_hash,'candidateContractSha256':hashlib.sha256(bytes_by_name['scene-contract.json']).hexdigest(),'status':'candidate; not promoted or signed','changes':changes,'files':{name:{'before':hashlib.sha256(originals[name]).hexdigest(),'after':hashlib.sha256(data).hexdigest()} for name,data in bytes_by_name.items()}}
(out/'assembly-record.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'candidateContractSha256':record['candidateContractSha256'],'assertedChanges':len(changes),'directory':str(out)}))
