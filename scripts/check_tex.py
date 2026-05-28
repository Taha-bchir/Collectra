import re, json, sys
p=r'd:\\STAGE PFE\\Collectra\\New Text Document.tex'
with open(p,encoding='utf-8',errors='replace') as f:
    lines=f.readlines()

# find tabular begins
tabular_positions=[]
for i,l in enumerate(lines, start=1):
    if re.search(r'\\begin\{tabular', l):
        tabular_positions.append(i)

# brace balance
cum=0
first_negative=None
for i,l in enumerate(lines, start=1):
    for ch in l:
        if ch=='{': cum+=1
        elif ch=='}': cum-=1
    if cum<0 and first_negative is None:
        first_negative=i

brace_balance=cum

# environment stack
stack=[]
unmatched_ends=[]
for i,l in enumerate(lines, start=1):
    for m in re.finditer(r'\\begin\{([^}]+)\}', l):
        stack.append((m.group(1), i))
    for m in re.finditer(r'\\end\{([^}]+)\}', l):
        name=m.group(1)
        if stack and stack[-1][0]==name:
            stack.pop()
        else:
            unmatched_ends.append((name,i))

# prepare context for tabulars
contexts={}
for pos in tabular_positions:
    start=max(1,pos-8)
    contexts[pos]= ''.join(lines[start-1:pos+8])

# find ampersands outside tabular-like environments
outside_ampersands=[]
in_tabular=False
for i,l in enumerate(lines, start=1):
    if re.search(r'\\begin\{tabular', l): in_tabular=True
    if re.search(r'\\end\{tabular', l): in_tabular=False
    if '&' in l and not in_tabular:
        outside_ampersands.append((i,l.strip()))

result={'tabular_positions':tabular_positions,'brace_balance':brace_balance,'first_negative_brace_line':first_negative,'unmatched_begin_stack':stack,'unmatched_ends':unmatched_ends,'outside_ampersands':outside_ampersands}
print(json.dumps(result,ensure_ascii=False,indent=2))