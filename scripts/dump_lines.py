p=r'd:\\STAGE PFE\\Collectra\\New Text Document.tex'
with open(p,encoding='utf-8',errors='surrogateescape') as f:
    lines=f.readlines()
for i in range(494,512):
    print(i+1, repr(lines[i]))
