const express = require('express');
const manifest = require('./manifest');
const { getUpcomingByTeam, getEventByMatchup } = require('./matchup');
const scraper = require('./scraper');
const { encodeEventId, decodeEventId } = require('./eventId');

const app = express();
const PORT = process.env.PORT || 7860;

// CORS aperto: richiesto dal protocollo Stremio/Nuvio.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/manifest.json', (req, res) => res.json(manifest));

function labelFor(ev) {
  return `${ev.home} - ${ev.away}`;
}

function descriptionFor(ev) {
  const parts = [];
  if (ev.competition) parts.push(`Competizione: ${ev.competition}`);
  const when = [ev.date, ev.time].filter(Boolean).join(' ');
  if (when) parts.push(`Data: ${when}`);
  parts.push(
    ev.channel
      ? `Canale/Piattaforma IT: ${ev.channel}`
      : 'Canale/Piattaforma IT: non disponibile per questo evento'
  );
  parts.push('Fonte canale: calciointv.com (non ufficiale)');
  return parts.join('\n');
}

function toMeta(ev) {
  return {
    id: encodeEventId(ev),
    type: 'tv',
    name: labelFor(ev),
    description: descriptionFor(ev),
    releaseInfo: [ev.date, ev.time].filter(Boolean).join(' '),
    genres: [ev.competition, ev.channel].filter(Boolean),
  };
}

// Catalogo. Due modalità:
//  - senza search  -> /catalog/tv/calcio_tv_ita.json          (lista sfogliabile)
//  - con search    -> /catalog/tv/calcio_tv_ita/search=NOME.json
app.get('/catalog/tv/:id.json', async (req, res) => {
  try {
    const all = await scraper.getAllEvents();
    res.json({ metas: all.map(toMeta) });
  } catch (err) {
    console.error('catalog error:', err.message);
    res.json({ metas: [] });
  }
});

app.get('/catalog/tv/:id/:extra.json', async (req, res) => {
  try {
    const extra = decodeURIComponent(req.params.extra || '');
    const m = extra.match(/search=([^&]+)/);
    const query = m ? decodeURIComponent(m[1]) : null;

    if (!query) {
      const all = await scraper.getAllEvents();
      return res.json({ metas: all.map(toMeta) });
    }

    const found = await scraper.findEventsByTeamName(query);
    res.json({ metas: found.map(toMeta) });
  } catch (err) {
    console.error('catalog search error:', err.message);
    res.json({ metas: [] });
  }
});

// Dettaglio evento
app.get('/meta/tv/:id.json', async (req, res) => {
  try {
    const decoded = decodeEventId(req.params.id);
    if (!decoded) return res.json({ meta: null });

    const all = await scraper.getAllEvents();
    const ev =
      all.find(
        (e) => e.date === decoded.date && e.home === decoded.home && e.away === decoded.away
      ) || null;

    if (!ev) {
      return res.json({
        meta: {
          id: req.params.id,
          type: 'tv',
          name: `${decoded.home} - ${decoded.away}`,
          description: 'Evento non più presente nel palinsesto corrente.',
        },
      });
    }

    res.json({ meta: toMeta(ev) });
  } catch (err) {
    console.error('meta error:', err.message);
    res.json({ meta: null });
  }
});

// Endpoint REST di comodo (browser/curl)
app.get('/search', async (req, res) => {
  try {
    const { team, teamA, teamB } = req.query;
    if (teamA && teamB) return res.json(await getEventByMatchup(teamA, teamB));
    if (team) return res.json(await getUpcomingByTeam(team));
    res.status(400).json({ error: 'Specifica ?team=NOME oppure ?teamA=NOME&teamB=NOME' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// Lista completa palinsesto scrapato (utile per verifica rapida)
app.get('/all', async (req, res) => {
  try {
    res.json(await scraper.getAllEvents());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send(
    'Addon Calcio TV Italia attivo. Manifest: /manifest.json — Palinsesto: /all — Ricerca: /search?team=Juventus'
  );
});

app.listen(PORT, () => {
  console.log(`Addon in ascolto su http://localhost:${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
});
