export type Result = { ok: true; value: string } | { ok: false; error: string };

const BASIC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes & < > " ' — and, with `nonAscii`, every character above U+007F as a decimal entity. */
export function encodeEntities(input: string, nonAscii = false): Result {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (BASIC[ch]) out += BASIC[ch];
    else if (nonAscii && cp > 0x7f) out += `&#${cp};`;
    else out += ch;
  }
  return { ok: true, value: out };
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
  copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", minus: "−",
  lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", laquo: "«", raquo: "»", lsaquo: "‹", rsaquo: "›",
  bull: "•", middot: "·", deg: "°", plusmn: "±", times: "×", divide: "÷", micro: "µ", para: "¶", sect: "§",
  euro: "€", pound: "£", yen: "¥", cent: "¢", curren: "¤", iexcl: "¡", iquest: "¿", brvbar: "¦", not: "¬", shy: "­",
  frac12: "½", frac14: "¼", frac34: "¾", sup1: "¹", sup2: "²", sup3: "³", ordf: "ª", ordm: "º", macr: "¯", acute: "´", cedil: "¸", uml: "¨",
  larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔", lArr: "⇐", rArr: "⇒", hArr: "⇔",
  le: "≤", ge: "≥", ne: "≠", asymp: "≈", equiv: "≡", infin: "∞", sum: "∑", prod: "∏", radic: "√", part: "∂", nabla: "∇", isin: "∈", empty: "∅",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", omega: "ω",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Omega: "Ω",
  hearts: "♥", spades: "♠", clubs: "♣", diams: "♦", check: "✓", star: "☆", dagger: "†", Dagger: "‡", permil: "‰", prime: "′", Prime: "″",
  szlig: "ß", aelig: "æ", AElig: "Æ", oslash: "ø", Oslash: "Ø", eth: "ð", ETH: "Ð", thorn: "þ", THORN: "Þ", oelig: "œ", OElig: "Œ",
  aring: "å", Aring: "Å", ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ",
};

// á à â ä and friends for every vowel, built from combining marks.
const MARKS: [string, string][] = [["acute", "́"], ["grave", "̀"], ["circ", "̂"], ["uml", "̈"]];
for (const v of ["a", "e", "i", "o", "u", "y"]) {
  for (const [name, mark] of MARKS) {
    for (const base of [v, v.toUpperCase()]) {
      const ch = (base + mark).normalize("NFC");
      if (ch.length === 1) NAMED[`${base}${name}`] ??= ch;
    }
  }
}

/** Decodes named (common HTML set), decimal (&#169;) and hex (&#xA9;) entities. Unknown ones stay as written. */
export function decodeEntities(input: string): Result {
  const value = input.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const cp = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "�";
      return String.fromCodePoint(cp);
    }
    return NAMED[body] ?? whole;
  });
  return { ok: true, value };
}
