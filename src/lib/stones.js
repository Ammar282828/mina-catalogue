/**
 * The house's stone wording, applied to every description the site shows.
 *
 * House of Mina sets simulated stones and American Diamonds. Its rule (the
 * Shopify theme's WORKLOG, and the owner again on 2026-09-23): a coloured stone
 * is always "simulated" — Simulated Ruby, Simulated Emerald — never "real",
 * "natural" or unqualified; "CZ" / "cubic zirconia" / zircon are "American
 * Diamonds". Shopify's copy and the catalogue PDF do not always follow it, so the
 * site does, at build time, for every piece (a later sync cannot undo it).
 *
 * Moissanite and lab-grown diamond are left alone: they are options the shop
 * prices and sells as such (Adele: moissanite PKR 27,000, lab-grown 101,000).
 * Product NAMES are left alone too ("Azira Sapphire Ring" is a name).
 */

const GEMS = 'rub(?:y|ies)|emeralds?|sapphires?|amethysts?|topaz(?:es)?|peridots?|opals?|citrines?|garnets?|aquamarines?|morganites?|tourmalines?|tanzanites?|spinels?|onyx';
// Words that may sit between "simulated" and the stone: intensity, cut, colour, cut
// ("vivid 1-carat oval ruby", "emerald blue topaz", "pear-cut blue sapphire").
const CUT = '(?:(?:\\d+(?:\\.\\d+)?\\s*-?\\s*(?:carat|ct)|oval|round|pear|cushion|princess|heart|marquise|trillion|square|baguette|emerald|octagon)(?:[\\s-]+(?:cut|shaped))?\\s+)?';
const ADJ = '(?:(?:london|sky|swiss|deep|vivid|rich|royal|fiery|dark|light|pale|soft|bright|blood|pigeon|cornflower|midnight|electric|icy)\\s+)?'
  + CUT
  + '(?:(?:blue|red|pink|green|yellow|purple|violet|white|black|golden|orange|teal|lavender|lilac|fire|mint)\\s+)?'
  + CUT;

/** Right after a stone word: it is a colour or a cut, not a stone ("emerald cut", "ruby red"). */
const NOT_A_STONE = /^(?:[\s-]+(?:cut|shaped?|shape|red|green|pink|blue|purple|violet|yellow|orange|hue|hues|tone|tones|toned|coloured|colored|gardens?|isle|city))/i;
/** Right before "emerald": a list of cuts, or a "Cut:" label. */
const CUT_CONTEXT = /(?:\bcuts?:\s*|\b(?:marquise|oval|round|pear|princess|cushion|heart|baguette|square|radiant|asscher)[,\s]+(?:(?:and|or|&)\s+)?(?:[\w-]+[,\s]+(?:(?:and|or|&)\s+)?){0,3})$/i;
/** A noun after a CZ word makes it an adjective: "an American Diamond accent", "American Diamond stones". */
const AD_NOUN = '(?:accents?|centerpiece|centrepiece|center|centre|stones?|bloom|halo|pav[ée]|details?|settings?|studs?|clusters?|surround)';

const cap = (w, like) => (/^[A-Z]/.test(like) ? w[0].toUpperCase() + w.slice(1) : w);
const isTitleCase = (phrase) => phrase.trim().split(/\s+/).every((w) => /^[A-Z0-9]/.test(w));

/**
 * `emeraldIsCut`: the piece's stone is moissanite or lab-grown diamond, so
 * "emerald" in its text is the emerald cut ("a classic emerald ring").
 */
export function houseWording(text, { emeraldIsCut = false } = {}) {
  if (!text) return text;
  let s = String(text);

  // CZ / zircon → American Diamond(s): singular before a noun or after "a", else plural.
  s = s.replace(new RegExp(`\\b((?:AAA\\s+)?cubic\\s+zirconias?|(?:european\\s+|pav[ée]\\s+)?zircon(?:ia)?s?|CZs?)\\b(?=(\\s+${AD_NOUN}\\b)?)`, 'gi'), (m, word, noun, offset, whole) => {
    if (/^cz/i.test(word) && word !== word.toUpperCase()) return m;           // "cz" inside a word — not ours
    const plural = /s$/i.test(word) && !/zirconia$/i.test(word);
    const lead = whole.slice(Math.max(0, offset - 40), offset);
    const single = !plural && (noun || /\b(?:a|an|one|single)\s+(?:[\w-]+\s+){0,4}$/i.test(lead));
    return cap(single ? 'American Diamond' : 'American Diamonds', word);
  });
  s = s.replace(/\bAmerican Diamonds? diamonds?\b/gi, (m) => cap('American Diamonds', m));
  s = s.replace(new RegExp(`\\bAmerican Diamonds (${AD_NOUN})\\b`, 'g'), 'American Diamond $1');

  // "real" / "natural" / "genuine" before a stone → "simulated", and no mine of origin.
  s = s.replace(new RegExp(`\\b(real|natural|genuine)(\\s+(?:${ADJ}))(?=(?:${GEMS})\\b)`, 'gi'),
    (m, word, rest) => `${cap('simulated', word)}${rest}`);
  s = s.replace(/\b(real|natural) or simulated\b/gi, (m) => cap('simulated', m));
  // A simulated stone has no mine: drop "from Mozambique" (capitalised place words only).
  s = s.replace(new RegExp(`\\b(simulated\\s+(?:[\\w-]+\\s+){0,3}?(?:${GEMS}))(\\s+(?:mined\\s+in|sourced\\s+from|from))((?:\\s+[\\w-]+){1,2})`, 'gi'),
    (m, stone, via, place) => {
      const words = place.trim().split(/\s+/);
      const n = words.findIndex((w) => !/^[A-Z][a-z]/.test(w));
      const kept = n === -1 ? '' : ` ${words.slice(n).join(' ')}`;
      return n === 0 ? m : `${stone}${kept}`;
    });

  // Any other coloured stone that is not already simulated gets the word.
  const stoneRe = new RegExp(`(^|[^\\w-])(${ADJ})(${GEMS})\\b`, 'gi');
  s = s.replace(stoneRe, (m, lead, adj, gem, offset, whole) => {
    const at = offset + lead.length;
    const after = whole.slice(offset + m.length);
    const before = whole.slice(Math.max(0, at - 40), at);
    const phrase = `${adj}${gem}`;
    if (/simulated\s+(?:[\w-]+\s+){0,3}$/i.test(before)) return m;           // already said
    if (/-$/.test(before)) return m;                                          // "sapphire-blue", "…-ruby"
    if (NOT_A_STONE.test(after)) return m;                                    // "emerald cut", "ruby red"
    if (/^emerald$/i.test(gem) && !adj && (emeraldIsCut || CUT_CONTEXT.test(before))) return m;
    if (/^[A-Z]/.test(phrase) && /^\s+[A-Z][a-z]/.test(after) && !/:\s*$/.test(before)) return m; // a name: "Azira Sapphire Ring"
    const start = /(?:^|[.!?]\s*|—\s*)$/.test(before) || (lead === '' && at === 0);
    const label = /[:&,]\s*$/.test(before);                                   // "Stone: Blue Topaz", "… & Blue Topaz"
    if (isTitleCase(phrase) && (label || !start || /\s/.test(phrase.trim()))) return `${lead}Simulated ${phrase}`;
    return start
      ? `${lead}Simulated ${phrase[0].toLowerCase()}${phrase.slice(1)}`
      : `${lead}simulated ${phrase}`;
  });
  // Tidy what the swaps leave behind.
  s = s.replace(/\b(a|an)(\s+)(simulated)\b/gi, (m, art, sp, sim) => `${cap('a', art)}${sp}${sim}`);
  s = s.replace(/\b(?:untreated|glass[- ]filled|heated|certified|mined)\s+(simulated)\b/gi, '$1');
  s = s.replace(/\bEuropean\s+(American Diamonds?)\b/g, '$1');
  return s;
}

/** Stone facet values as the site shows them (filters, the piece's Stones line). */
export const STONE_LABEL = {
  Emerald: 'Simulated Emerald',
  Ruby: 'Simulated Ruby',
  Sapphire: 'Simulated Sapphire',
  Amethyst: 'Simulated Amethyst',
  'Blue Topaz': 'Simulated Blue Topaz',
  Opal: 'Simulated Opal',
  Zircon: 'American Diamond',
};
export const stoneLabel = (v) => STONE_LABEL[v] || v;
