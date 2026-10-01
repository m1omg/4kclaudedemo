#!/usr/bin/env python3
"""GLSL minifier for the 4k intro.

Strips comments and whitespace, shortens float literals and renames all
user-defined identifiers to short names, most frequent first. Renaming is
scope aware: every function's parameters and locals reuse the same pool of
short names (only globals are unique). Writes shaders.h (C) and shaders.inc
(nasm) with the minified sources.

tools/names.json (made by tools/namesearch.py) can fix the short name of any
identifier, per shader and scope; LZMA packs some namings better than
others. Identifiers it does not list get the default names.

    minify.py music.frag visual.frag -o shaders.h
"""
import itertools
import json
import os
import re
import sys

NAMES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'names.json')

TYPES = set('float int uint void bool vec2 vec3 vec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4 bvec2 bvec3 bvec4 '
            'mat2 mat3 mat4 sampler2D'.split())
QUALIFIERS = set('const uniform in out inout flat smooth highp mediump lowp layout'.split())
KEYWORDS = TYPES | QUALIFIERS | set('''
attribute varying centroid noperspective break continue do for while switch case default if else true false
invariant discard return precision struct
radians degrees sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh pow exp log exp2 log2 sqrt
inversesqrt abs sign floor trunc round roundEven ceil fract mod modf min max clamp mix step smoothstep
isnan isinf floatBitsToInt floatBitsToUint intBitsToFloat uintBitsToFloat length distance dot cross
normalize faceforward reflect refract matrixCompMult outerProduct transpose determinant inverse
lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not texture textureSize
texelFetch dFdx dFdy fwidth main gl_FragCoord gl_VertexID gl_Position gl_FragColor version location
'''.split())
KEEP = {'u', 'o'}  # uniform name is looked up by name on macOS; o is already short

TOKEN = re.compile(r'''
    (?P<pre>\#[^\n]*)|
    (?P<num>0[xX][0-9a-fA-F]+[uU]?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[uU]?)|
    (?P<id>[A-Za-z_]\w*)|
    (?P<op><<=|>>=|<<|>>|\+\+|--|&&|\|\||==|!=|<=|>=|[-+*/%^&|]=|[-+*/%<>=!&|^~?:;,.(){}\[\]])|
    (?P<ws>\s+)
''', re.X)


def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', ' ', s, flags=re.S)
    return re.sub(r'//[^\n]*', '', s)


def tokenize(s):
    out, pos = [], 0
    while pos < len(s):
        m = TOKEN.match(s, pos)
        if not m:
            raise SyntaxError('cannot tokenize at: %r' % s[pos:pos + 30])
        pos = m.end()
        if m.lastgroup != 'ws':
            out.append([m.lastgroup, m.group()])
    return out


def short_float(t):
    if t.startswith(('0x', '0X')) or t.endswith(('u', 'U')):
        return t
    if not re.search(r'[.eE]', t):
        return t  # integer literal
    v = float(t)
    if v == 0:
        return '0.'
    best = None
    for cand in (repr(v), '%.8g' % v, '%.7g' % v):
        if float(cand) != float(t):
            continue
        m, _, e = cand.partition('e')
        if '.' not in m and not e:
            m += '.'
        if m.startswith('0.') and m != '0.':
            m = m[1:]
        if m.endswith('.0'):
            m = m[:-1]
        if m.endswith('.') and e:
            m = m[:-1]
        c = m + ('e' + str(int(e)) if e else '')
        if best is None or len(c) < len(best):
            best = c
    mm = re.fullmatch(r'(\d+?)(0+)\.', best)
    if mm and len(mm.group(2)) >= 3:
        best = mm.group(1) + 'e' + str(len(mm.group(2)))
    return best


def is_member(toks, i):
    return i > 0 and toks[i - 1][1] == '.'


def analyze(toks):
    """Finds declarations. Returns (scope of every token: None = global,
    otherwise the enclosing function name; set of (scope, name) declarations)."""
    decls = set()
    scope_of = [None] * len(toks)
    depth = 0          # brace depth
    func = None        # function whose body we are in
    pending = None     # function whose parameter list we are in
    i = 0
    while i < len(toks):
        k, v = toks[i]
        scope_of[i] = func if depth > 0 else pending
        if v == '{':
            if pending:
                func, pending = pending, None
            depth += 1
        elif v == '}':
            depth -= 1
            if depth == 0:
                func = None
        elif k == 'id' and v in TYPES and i + 1 < len(toks) and toks[i + 1][0] == 'id' \
                and toks[i + 1][1] not in KEYWORDS:
            j = i + 1
            if depth == 0 and not pending and j + 1 < len(toks) and toks[j + 1][1] == '(':
                decls.add((None, toks[j][1]))      # function definition
                scope_of[j] = None
                pending = toks[j][1]
                i = j + 1
                scope_of[i] = pending
                i += 1
                continue
            scope = pending or (func if depth > 0 else None)
            par = 0
            while j < len(toks):                   # declarators, comma separated
                t = toks[j][1]
                scope_of[j] = func if depth > 0 else pending
                if toks[j][0] == 'id' and par == 0 and (toks[j - 1][1] in TYPES or toks[j - 1][1] == ','):
                    decls.add((scope, t))
                if t in '([':
                    par += 1
                elif t in ')]':
                    if par == 0:
                        break
                    par -= 1
                elif t == ';' or (t == ',' and pending and par == 0):
                    break
                j += 1
            i = j
            continue
        i += 1
    return scope_of, decls


def name_pool():
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for n in range(1, 3):
        for t in itertools.product(letters, repeat=n):
            yield ''.join(t)


def groups(src):
    """Identifier groups of a shader: {scope: [identifiers, most frequent first]}
    (scope '' = globals, otherwise the function name), plus the tokens."""
    toks = tokenize(strip_comments(src))
    scope_of, decls = analyze(toks)
    count, refs = {}, []
    for i, (k, v) in enumerate(toks):
        if k != 'id' or v in KEYWORDS or v in KEEP or is_member(toks, i):
            continue
        f = scope_of[i]
        key = (f, v) if f is not None and (f, v) in decls else (None, v)
        count[key] = count.get(key, 0) + 1
        refs.append((i, key))
    out = {}
    for key in sorted(count, key=lambda x: (-count[x], x[1])):
        out.setdefault(key[0] or '', []).append(key[1])
    return out, toks, refs


def load_names(name):
    """The part of tools/names.json for a shader file name ({} if none)."""
    if name and os.path.exists(NAMES):
        return json.load(open(NAMES)).get(os.path.basename(name), {})
    return {}


def assign(src, table):
    """Short names for all identifiers: {scope: {identifier: short name}}.
    table: fixed names ({scope: {identifier: short name}}), used where valid."""
    grp, toks, refs = groups(src)
    reserved = KEYWORDS | KEEP
    mapping = {}
    used_global = set()
    for scope in [''] + [f for f in grp if f]:
        fixed = table.get(scope, {})
        used = set(used_global) if scope else set()
        wanted = {v: n for v, n in fixed.items() if v in grp.get(scope, []) and n not in reserved}
        taken = set()
        for v in grp.get(scope, []):   # table names first (if still free)
            n = wanted.get(v)
            if n and n not in used and n not in taken:
                mapping[(scope or None, v)] = n
                taken.add(n)
        gen = name_pool()
        for v in grp.get(scope, []):
            if (scope or None, v) in mapping:
                continue
            n = next(gen)
            while n in reserved or n in used or n in taken:
                n = next(gen)
            mapping[(scope or None, v)] = n
            taken.add(n)
        if not scope:
            used_global = taken
    names = {}
    for (scope, v), n in mapping.items():
        names.setdefault(scope or '', {})[v] = n
    return names, toks, refs


def minify_one(src, name=None, table=None):
    """name: the shader's file name, to look up its part of tools/names.json;
    table: that part directly ({scope: {identifier: short name}})."""
    names, toks, refs = assign(src, load_names(name) if table is None else table)
    for i, (scope, v) in refs:
        toks[i][1] = names[scope or ''][v]
    return render(toks)


def render(toks):
    out, prev, pk = '', None, None
    for k, v in toks:
        if k == 'num':
            v = short_float(v)
        if k == 'pre':
            out += ('\n' if out else '') + v + '\n'
            prev = None
            continue
        if prev and pk in ('id', 'num') and k in ('id', 'num'):
            out += ' '
        elif prev and prev[-1] in '+-' and v[0] in '+-':
            out += ' '
        out += v
        prev, pk = v, k
    return out


def nasm_db(s):
    items = []
    for k, line in enumerate(s.split('\n')):
        if k:
            items.append('10')
        if line:
            items.append('"%s"' % line)
    return ', '.join(items + ['0'])


def c_string(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'


if __name__ == '__main__':
    args = sys.argv[1:]
    out = 'shaders.h'
    if '-o' in args:
        i = args.index('-o')
        out = args[i + 1]
        del args[i:i + 2]
    mins = [minify_one(open(a).read(), a) for a in args]
    samples = 73 * 88200
    names = [re.sub(r'\W', '_', a.split('/')[-1]) for a in args]
    with open(out, 'w') as f:
        f.write('// generated by tools/minify.py - do not edit\n')
        f.write('#define SONG_SAMPLES %d\n' % samples)
        for name, m in zip(names, mins):
            f.write('static const char *%s = %s;\n' % (name, c_string(m)))
    with open(out.replace('.h', '.inc'), 'w') as f:
        f.write('; generated by tools/minify.py - do not edit\n')
        f.write('SONG_SAMPLES equ %d\n' % samples)
        f.write('%%define SONG_SECONDS %r\n' % (samples / 44100))
        for name, m in zip(names, mins):
            f.write('%s: db %s\n' % (name, nasm_db(m)))
    for a, m in zip(args, mins):
        open(out + '.' + a.split('/')[-1] + '.min', 'w').write(m)
        print('%s: %d bytes' % (a, len(m)), file=sys.stderr)
