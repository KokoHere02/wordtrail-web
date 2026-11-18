const files = import.meta.glob<string>([
  '/font/{FZDWTJW,FZYouHJW_508R,FZYouHJW_510M}.{woff2,woff,otf,ttf,WOFF2,WOFF,OTF,TTF}',
  './{dawei,youhei-508r,youhei-510m}.{woff2,woff,otf,ttf}',
], {
  eager: true,
  import: 'default',
  query: '?url&no-inline',
});

function fontSources(localNames: string[], basenames: string[]) {
  const sources = localNames.map(name => `local("${name}")`);
  for (const ext of ['woff2', 'woff', 'otf', 'ttf']) {
    for (const basename of basenames) {
      const url = files[`${basename}.${ext}`] ?? files[`${basename}.${ext.toUpperCase()}`];
      if (url) sources.push(`url("${url}")`);
    }
  }
  return sources;
}

function youheiSources(style: '508R' | '510M') {
  return fontSources([
    `方正悠黑简体 ${style}`, `方正悠黑简体${style}`, `FZYouHS ${style}`,
    `FZYOUHJW_${style}--GB1-0`, `FZYOUHS_${style}--GB1-0`, `FZYOUHK_${style}--GBK1-0`,
  ], [`/font/FZYouHJW_${style}`, `./youhei-${style.toLowerCase()}`]);
}

function addFace(family: string, weight: string, sources: string[]) {
  const face = new FontFace(family, sources.join(', '), { weight, display: 'swap' });
  document.fonts.add(face);
}

export function registerFounderFonts() {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const dawei = fontSources([
    '方正大魏体简体', 'FZDaWeiTiS-R-GB', 'FZDWTJW--GB1-0',
  ], ['/font/FZDWTJW', './dawei']);
  const regular = youheiSources('508R');
  addFace('WordTrail Dawei', '1 1000', dawei);
  addFace('WordTrail Youhei', '1 500', regular);
  addFace('WordTrail Youhei', '501 1000', [...youheiSources('510M'), ...regular]);
}
