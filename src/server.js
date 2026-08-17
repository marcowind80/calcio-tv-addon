const express = require('express');
const manifest = require('./manifest');
const { getUpcomingByTeam, getEventByMatchup } = require('./matchup');

const app = express();
const PORT = process.env.PORT || 7860;

// CORS aperto: richiesto dal protocollo Stremio/Nuvio per far sì che l'app
// possa contattare l'addon da qualsiasi origine.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/manifest.json', (req, res) => {
  res.json(manifest);
});

// Catalogo con ricerca: Nuvio/Stremio chiamano
// /catalog/tv/calcio_tv_ita/search=NOME_SQUADRA.json
app.get('/catalog/tv/:id/:extra?.json', async (req, res) => {
  try {
    const extra = req.params.extra || '';
    const searchMatch = decodeURIComponent(extra).match(/search=([^&]+)/);
    const query = searchMatch ? decodeURIComponent(searchMatch[1]) : null;

    if (!query) {
      return res.json({ metas: [] });
    }

    const result = await getUpcomingByTeam(query);
    if (!result.found) {
      return res.json({ metas: [] });
    }

    const metas = result.events.map((ev) => ({
      id: `calciotvita_${ev.idEvent}`,
      type: 'tv',
      name: `${ev.home} - ${ev.away}`,
      poster: result.team.badge || undefined,
      description: buildDescription(ev),
      releaseInfo: ev.dateFormatted || undefined,
    }));

    res.json({ metas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ metas: [], error: 'internal_error' });
  }
});

// Meta dettaglio: Nuvio chiama /meta/tv/calciotvita_<idEvent>.json
// Qui non abbiamo un lookup diretto per idEvent isolato senza rifare la
// ricerca; per semplicità il dettaglio essenziale è già nella description
// del catalog. Questo endpoint risponde comunque in modo conforme.
app.get('/meta/tv/:id.json', async (req, res) => {
  res.json({
    meta: {
      id: req.params.id,
      type: 'tv',
      name: 'Dettaglio partita',
      description: 'Usa la ricerca del catalogo per i dettagli di canale/piattaforma e data.',
    },
  });
});

// Endpoint pratico REST (non-Stremio) per test manuali o uso diretto via browser/curl:
//   GET /search?team=Juventus
//   GET /search?teamA=Juventus&teamB=Napoli
app.get('/search', async (req, res) => {
  try {
    const { team, teamA, teamB } = req.query;
    if (teamA && teamB) {
      const result = await getEventByMatchup(teamA, teamB);
      return res.json(result);
    }
    if (team) {
      const result = await getUpcomingByTeam(team);
      return res.json(result);
    }
    res.status(400).json({ error: 'Specifica ?team=NOME oppure ?teamA=NOME&teamB=NOME' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

app.get('/', (req, res) => {
  res.send(
    'Addon Calcio TV Italia attivo. Manifest: /manifest.json — Ricerca test: /search?team=Juventus'
  );
});

function buildDescription(ev) {
  const parts = [];
  parts.push(`${ev.home} vs ${ev.away}`);
  if (ev.league) parts.push(`Competizione: ${ev.league}`);
  if (ev.dateFormatted) parts.push(`Data: ${ev.dateFormatted}`);
  if (ev.italianChannel) {
    parts.push(`Canale/Piattaforma IT: ${ev.italianChannel} (fonte: ${ev.channelSource})`);
  } else {
    parts.push('Canale/Piattaforma IT: non ancora disponibile per questo evento');
  }
  return parts.join('\n');
}

app.listen(PORT, () => {
  console.log(`Addon in ascolto su http://localhost:${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
});
