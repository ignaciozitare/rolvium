#!/usr/bin/env python3
"""
pen-css-tree — the exact CSS of a `.pen` frame, as a compact tree.

Why: the `.pen` stores the exact values of every element (colour, gradient and
its direction, opacity, radius, size, shadow, font). Porting a design by LOOKING
at a screenshot produced wrong gradients, wrong opacities and stretched layouts
(owner, 2026-10-05: «el .pen hace su css por cada componente y tú interpretas lo
que ves»). Read the values, never eyeball them.

1. Export the approved frame(s) with the pencil MCP (`execute` tool):
       Export(["<frameId>"], "html-css", "<scratchpad>/<frameId>.html",
              {includeLayerNames: true, includeLayerIds: true})
   The export already converts the pen's rotation to CSS (a bar `90deg` =
   left→right, a cell `0deg` = bottom→top). Never use Read/Grep on the .pen.
2. Dump it:
       python3 .claude/tools/pen-css-tree.py <file.html> <id|name:NodeName>[,…] [--all] [--depth N]
   Repeated siblings (rows, cells, chips, segments…) are shown once unless
   `--all` is passed — use `--all` when you need every instance to measure a
   data-driven formula (bar length, opacity per value, text/glow thresholds).

Map dark `$jt-*` literals to the app tokens (#141418 = --sf, #1b1b22 = --sf2,
#e4e4ef = --tx, #8888a8 = --tx2, #50506a = --tx3, #2a2a38 = --bd, #7b93ff = --ac2,
#0d0d10 = --bg). Light frames use a literal palette that only approximates the
app's light tokens: use tokens for neutral surfaces and text, and the exact
values for what belongs to the component itself (its gradients, its marks).
"""
import sys
from html.parser import HTMLParser

KEEP = ('color', 'background', 'font-size', 'font-weight', 'border', 'padding', 'gap',
        'height', 'width', 'box-shadow', 'opacity', 'text-transform', 'letter-spacing',
        'flex', 'justify-content', 'align-items', 'line-height', 'text-align', 'text-shadow')
NOISE = {'background-repeat', 'background-size', 'flex-direction', 'flex-shrink', 'box-sizing',
         'font-family', 'font-style'}
REPEATED = ('row', 'hmRow', 'cell', 'person', 'tot', 'seg', 'chip', 'lg', 'kpi', 'stat', 'nav')


class Tree(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = {'kids': [], 'parent': None}
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        node = {'id': a.get('data-pencil-id'), 'name': a.get('data-pencil-name'),
                'style': a.get('style', ''), 'kids': [], 'text': '', 'parent': self.cur}
        self.cur['kids'].append(node)
        self.cur = node

    def handle_endtag(self, tag):
        if self.cur['parent'] is not None:
            self.cur = self.cur['parent']

    def handle_data(self, data):
        if data.strip():
            self.cur['text'] += data.strip()


def short(style):
    out = []
    for decl in style.split(';'):
        if ':' not in decl:
            continue
        k, v = (x.strip() for x in decl.split(':', 1))
        if k in NOISE or not k.startswith(KEEP):
            continue
        if (k == 'gap' and v == '0px') or v in ('fit-content', 'normal', '0px') or (k == 'letter-spacing' and v == '0px'):
            continue
        out.append(f'{k}:{v}')
    return '; '.join(out)


def find(node, key):
    if node.get('id') == key or (key.startswith('name:') and node.get('name') == key[5:]):
        return node
    for kid in node['kids']:
        hit = find(kid, key)
        if hit:
            return hit
    return None


def dump(node, depth, max_depth, show_all):
    text = f"«{node['text'][:40]}» " if node['text'] else ''
    print('  ' * depth + f"[{node.get('id')}] {node.get('name')} {text}{{{short(node['style'])}}}")
    if depth >= max_depth:
        return
    seen = {}
    for kid in node['kids']:
        family = (kid.get('name') or '').split('·')[0]
        seen[family] = seen.get(family, 0) + 1
        if not show_all and family in REPEATED and seen[family] > 1:
            continue
        dump(kid, depth + 1, max_depth, show_all)


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    show_all = '--all' in argv
    max_depth = int(argv[argv.index('--depth') + 1]) if '--depth' in argv else 12
    tree = Tree()
    with open(argv[1], encoding='utf-8') as fh:
        tree.feed(fh.read())
    for key in argv[2].split(','):
        node = find(tree.root, key)
        print(f'==== {key}')
        if node:
            dump(node, 0, max_depth, show_all)
        else:
            print('not found')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
