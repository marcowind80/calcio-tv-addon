// Manifest protocollo Stremio/Nuvio.
// Nuvio è compatibile con il protocollo addon standard di Stremio, quindi
// usiamo un manifest.json conforme, con un catalogo custom "calcio_tv_ita".
module.exports = {
  id: 'org.marco.calciotvita',
  version: '1.0.0',
  name: 'Calcio TV Italia',
  description:
    'Cerca una squadra o una partita di calcio e scopri su quale canale/piattaforma italiana viene trasmessa e in che data. Dati eventi da TheSportsDB, dati canale da calciointv.com (fonte non ufficiale, best-effort).',
  logo: 'https://www.thesportsdb.com/images/logo-back.png',
  resources: ['catalog', 'meta'],
  types: ['tv'],
  catalogs: [
    {
      type: 'tv',
      id: 'calcio_tv_ita',
      name: 'Calcio TV Italia',
      extra: [{ name: 'search', isRequired: true }],
    },
  ],
  idPrefixes: ['calciotvita_'],
  behaviorHints: {
    configurable: false,
  },
};
