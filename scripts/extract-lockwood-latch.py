import pymupdf, pathlib, json
root=pathlib.Path('data/product-library/source-evidence/lockwood-internal')
doc=pymupdf.open(root/'general-hardware.pdf')
for page in doc:
    text=page.get_text()
    if '5260 Tubular Latch' not in text or '5260/1SFTCP' not in text: continue
    (root/'5260-specifications.txt').write_text(text,encoding='utf-8')
    images=[]
    for item in page.get_images():
        info=doc.extract_image(item[0])
        if info['width']<150 or info['height']<150: continue
        name=f"5260-page-{page.number+1}-image-{item[0]}.{info['ext']}"
        (root/name).write_bytes(info['image'])
        images.append({'file':name,'width':info['width'],'height':info['height']})
    print(json.dumps({'page':page.number+1,'images':images}))
