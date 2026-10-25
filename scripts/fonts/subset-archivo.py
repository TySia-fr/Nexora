"""Builds src/fonts/archivo-display.woff2 from the Archivo variable font (SIL OFL 1.1).

Keeps only what the display styles use, so the face is cheap enough to preload:
  - weight 500–600 and width 100–125% (the variable axes are limited, not removed)
  - Latin-1 plus the typographic punctuation, euro sign and arrows used in headings

  python3 -I scripts/fonts/subset-archivo.py   (needs: pip install fonttools brotli)
"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"
OUT = "src/fonts/archivo-display.woff2"
UNICODES = "U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+20AC,U+2192,U+2212"

font = TTFont(SRC)
font = instancer.instantiateVariableFont(font, {"wght": (500, 600), "wdth": (100, 125)})
opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["kern", "liga", "calt", "tnum", "case"]
opts.name_IDs = ["*"]
opts.notdef_outline = True
sub = subset.Subsetter(opts)
sub.populate(unicodes=subset.parse_unicodes(UNICODES))
sub.subset(font)
font.flavor = "woff2"
font.save(OUT)
print("wrote", OUT)
