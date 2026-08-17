// Alias per riconciliare i nomi squadra tra TheSportsDB (spesso in inglese
// o con denominazioni diverse) e calciointv.com (denominazioni italiane/locali).
// Chiave = forma normalizzata TheSportsDB, valore = array di forme alternative
// normalizzate da cercare sul sito guida TV.
// Lista non esaustiva: ampliabile in base ai casi che emergono in uso reale.
const ALIASES = {
  'inter milan': ['inter'],
  'ac milan': ['milan'],
  'athletic bilbao': ['athletic club', 'athletic'],
  'real sociedad': ['sociedad'],
  'atletico madrid': ['atletico madrid', 'atl madrid'],
  'internazionale': ['inter'],
  'juventus fc': ['juventus'],
  'as roma': ['roma'],
  'ss lazio': ['lazio'],
  'napoli': ['napoli'],
  'manchester united': ['manchester united', 'man utd', 'man united'],
  'manchester city': ['manchester city', 'man city'],
  'tottenham hotspur': ['tottenham'],
  'paris saint-germain': ['psg', 'paris sg'],
  'bayern munich': ['bayern', 'bayern monaco'],
  'borussia dortmund': ['dortmund'],
};

function expandAliases(normalizedName) {
  const variants = new Set([normalizedName]);
  if (ALIASES[normalizedName]) {
    ALIASES[normalizedName].forEach((v) => variants.add(v));
  }
  // ricerca anche al contrario: normalizedName è un alias di qualche chiave?
  for (const [key, vals] of Object.entries(ALIASES)) {
    if (vals.includes(normalizedName)) variants.add(key);
  }
  return Array.from(variants);
}

module.exports = { expandAliases };
