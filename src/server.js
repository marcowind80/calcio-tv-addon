const express = require('express');
const manifest = require('./manifest');
const { getUpcomingByTeam, getEventByMatchup } = require('./matchup');
const scraper = require('./scraper');
const { encodeEventId, decodeEventId } = require('./eventId');
const { renderPoster } = require('./poster');

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

// URL pubblico dell'istanza: dietro il proxy di Railway/Render occorre
// leggere gli header x-forwarded-* altrimenti si otterrebbe http://localhost.
function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function toMeta(ev, req) {
  const id = encodeEventId(ev);
  const poster = `${baseUrl(req)}/poster/${id}.png`;
  return {
    id,
    type: 'tv',
    name: labelFor(ev),
    description: descriptionFor(ev),
    releaseInfo: [ev.date, ev.time].filter(Boolean).join(' '),
    genres: [ev.competition, ev.channel].filter(Boolean),
    poster,
    posterShape: 'poster',
    background: poster,
  };
}

// Catalogo. Due modalità:
//  - senza search  -> /catalog/tv/calcio_tv_ita.json          (lista sfogliabile)
//  - con search    -> /catalog/tv/calcio_tv_ita/search=NOME.json
app.get('/catalog/tv/:id.json', async (req, res) => {
  try {
    const all = await scraper.getAllEvents();
    res.json({ metas: all.map((ev) => toMeta(ev, req)) });
  } catch (err) {
    console.error('catalog error:', err.message);
    res.json({ metas: [] });
  }
});

app.get('/catalog/tv/:id/:extra.json', async (req, res) => {
  try {
    const extra = decodeURIComponent(req.params.extra || '');

    const searchMatch = extra.match(/search=([^&]+)/);
    const genreMatch = extra.match(/genre=([^&]+)/);

    if (searchMatch) {
      const query = decodeURIComponent(searchMatch[1]);
      const found = await scraper.findEventsByTeamName(query);
      return res.json({ metas: found.map((ev) => toMeta(ev, req)) });
    }

    const all = await scraper.getAllEvents();

    if (genreMatch) {
      const genre = decodeURIComponent(genreMatch[1]).toLowerCase().trim();
      const filtered = all.filter(
        (ev) => (ev.competition || '').toLowerCase().trim() === genre
      );
      return res.json({ metas: filtered.map((ev) => toMeta(ev, req)) });
    }

    res.json({ metas: all.map((ev) => toMeta(ev, req)) });
  } catch (err) {
    console.error('catalog extra error:', err.message);
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

    res.json({ meta: toMeta(ev, req) });
  } catch (err) {
    console.error('meta error:', err.message);
    res.json({ meta: null });
  }
});

// Locandina PNG generata al volo per una scheda del catalogo.
app.get('/poster/:id.png', async (req, res) => {
  try {
    const decoded = decodeEventId(req.params.id);
    if (!decoded) return res.status(404).end();

    const all = await scraper.getAllEvents();
    const ev =
      all.find(
        (e) => e.date === decoded.date && e.home === decoded.home && e.away === decoded.away
      ) || { ...decoded, competition: null, channel: null, time: null };

    const png = await renderPoster(ev);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(png);
  } catch (err) {
    console.error('poster error:', err.message);
    res.status(500).end();
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

// Stato dell'autoaggiornamento (diagnostica rapida)
app.get('/status', (req, res) => {
  res.json({ ok: true, ...scraper.refreshStatus() });
});

// Forza un aggiornamento immediato del palinsesto
app.get('/refresh', async (req, res) => {
  const events = await scraper.refreshNow();
  res.json({ refreshed: true, events: events.length, ...scraper.refreshStatus() });
});

app.listen(PORT, () => {
  console.log(`Addon in ascolto su http://localhost:${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
  scraper.startAutoRefresh();
});
