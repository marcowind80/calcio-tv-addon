// Scraper best-effort di calciointv.com per ottenere canale/piattaforma italiana
// delle partite di calcio. Fonte NON ufficiale: i dati sono quelli pubblicati
// dal sito e possono contenere errori o essere assenti per alcuni eventi.
//
// Struttura pagina (verificata manualmente il 2026-08-17):
// - blocco settimana: https://www.calciointv.com/  (index.php)
// - blocco "oggi": https://www.calciointv.com/indexoggi.php
// - ogni giorno: <h3><a href="dia.php?fecha=YYYY-MM-DD">...</a></h3>
// - ogni partita: bandiera + link competizione " - " + canale/piattaforma
//   poi due link squadra (con href team.php?team=CODICE) e un orario HH:MM in mezzo

const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const { expandAliases } = require('./teamAliases');

const cache = new NodeCache({ stdTTL: 60 * 30 }); // 30 minuti

const SOURCE_URLS = {
  week: 'https://www.calciointv.com/',
  today: 'https://www.calciointv.com/indexoggi.php',
  nextWeek: 'https://www.calciointv.com/index2.php',
};

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
};

function normalizeTeamName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return data;
}

// Parsa una pagina calciointv.com e restituisce array di eventi normalizzati.
//
// Approccio: invece di affidarci a wrapper CSS puliti (il sito non ne ha),
// camminiamo l'albero DOM in ordine di apparizione (depth-first, come fa
// cheerio con i selettori multipli separati da virgola SOLO se il documento
// è attraversato con `*` — qui usiamo invece un tree-walk esplicito) e
// costruiamo gli eventi da un piccolo automa a stati:
//   dia.php (data) -> indexfi.php?comp= (competizione) -> testo " - CANALE"
//   -> team.php (squadra1) -> testo "HH:MM" -> team.php (squadra2)
// Questo evita il bug del fallback posizionale sugli orari (join separato
// tra lista canali e lista orari), che si sarebbe disallineato se il numero
// di blocchi non avesse orario esplicito.
function parsePage(html) {
  const $ = cheerio.load(html);
  const events = [];
  let currentDate = null;
  let pending = null; // evento in costruzione

  function pushPending() {
    if (pending && pending.teams.length >= 2) {
      events.push({
        date: pending.date,
        time: pending.time,
        competition: pending.competition,
        channel: pending.channel,
        home: pending.teams[0].name,
        homeCode: pending.teams[0].code,
        away: pending.teams[1].name,
        awayCode: pending.teams[1].code,
        homeNorm: normalizeTeamName(pending.teams[0].name),
        awayNorm: normalizeTeamName(pending.teams[1].name),
      });
    }
    pending = null;
  }

  // Tree-walk di tutti i nodi (elementi e testo) in ordine documentale.
  function walk(node) {
    if (!node) return;
    const nodes = Array.isArray(node) ? node : [node];
    for (const n of nodes) {
      if (n.type === 'text') {
        const txt = (n.data || '').trim();
        if (txt) {
          // Orario HH:MM isolato -> assegna al blocco pending
          const timeMatch = txt.match(/^(\d{2}:\d{2})$/);
          if (timeMatch && pending && !pending.time) {
            pending.time = timeMatch[1];
          }
          // Testo tipo "- DAZN" o "- Canale 20" dopo il link competizione
          if (pending && pending.channel === null && /^-\s*\S/.test(txt)) {
            pending.channel = txt.replace(/^-\s*/, '').trim();
          }
        }
      } else if (n.type === 'tag') {
        if (n.name === 'a') {
          const $el = $(n);
          const href = $el.attr('href') || '';

          if (href.startsWith('dia.php')) {
            pushPending();
            const m = href.match(/fecha=([\d-]+)/);
            if (m) currentDate = m[1];
          } else if (href.includes('indexfi.php?comp=')) {
            pushPending();
            pending = {
              date: currentDate,
              competition: $el.text().trim(),
              channel: null,
              time: null,
              teams: [],
            };
          } else if (href.includes('team.php?team=')) {
            if (!pending) {
              pending = { date: currentDate, competition: null, channel: null, time: null, teams: [] };
            }
            const teamCode = (href.match(/team=([a-z0-9]+)/i) || [])[1] || null;
            pending.teams.push({ name: $el.text().trim(), code: teamCode });
          }
        }
        if (n.children && n.children.length) {
          walk(n.children);
        }
      }
    }
  }

  const bodyNode = $('body').get(0);
  if (bodyNode) walk(bodyNode);
  pushPending();

  return events;
}

async function getAllEvents({ forceRefresh = false } = {}) {
  const cacheKey = 'events_all';
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const results = [];
  for (const url of [SOURCE_URLS.week, SOURCE_URLS.nextWeek]) {
    try {
      const html = await fetchHtml(url);
      results.push(...parsePage(html));
    } catch (err) {
      console.error(`Errore scraping ${url}:`, err.message);
    }
  }

  // Deduplica per (date, homeNorm, awayNorm)
  const seen = new Set();
  const deduped = [];
  for (const ev of results) {
    const key = `${ev.date}|${ev.homeNorm}|${ev.awayNorm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ev);
  }

  cache.set(cacheKey, deduped);
  return deduped;
}

// Cerca un evento per nome squadra (una qualsiasi delle due) usando match "contains"
// sul nome normalizzato. Ritorna tutti gli eventi futuri trovati.
async function findEventsByTeamName(teamName) {
  const variants = expandAliases(normalizeTeamName(teamName));
  const all = await getAllEvents();
  return all.filter((ev) =>
    variants.some(
      (norm) =>
        ev.homeNorm.includes(norm) ||
        ev.awayNorm.includes(norm) ||
        norm.includes(ev.homeNorm) ||
        norm.includes(ev.awayNorm)
    )
  );
}

// Cerca un evento specifico per coppia di squadre (home/away in qualsiasi ordine)
async function findEventByMatchup(teamA, teamB) {
  const aVariants = expandAliases(normalizeTeamName(teamA));
  const bVariants = expandAliases(normalizeTeamName(teamB));
  const all = await getAllEvents();
  const matches = (variants, evName) => variants.some((v) => evName.includes(v) || v.includes(evName));
  return all.find((ev) => {
    const pair1 = matches(aVariants, ev.homeNorm) && matches(bVariants, ev.awayNorm);
    const pair2 = matches(bVariants, ev.homeNorm) && matches(aVariants, ev.awayNorm);
    return pair1 || pair2;
  });
}

module.exports = {
  getAllEvents,
  findEventsByTeamName,
  findEventByMatchup,
  normalizeTeamName,
  parsePage, // esportata anche per test unitari sul parsing HTML
};
