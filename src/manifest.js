// Manifest protocollo Stremio/Nuvio.
// Il catalogo è SFOGLIABILE: si apre mostrando le partite dei prossimi giorni
// con il canale italiano. La ricerca è opzionale (non isRequired), altrimenti
// Stremio/Nuvio non mostrerebbe affatto il catalogo nella schermata principale.
module.exports = {
  id: 'org.marco.calciotvita',
  version: '1.1.0',
  name: 'Calcio TV Italia',
  description:
    'Partite di calcio con canale/piattaforma italiana e data. Dati canale da calciointv.com (fonte non ufficiale, best-effort).',
  logo: 'https://www.thesportsdb.com/images/logo-back.png',
  resources: ['catalog', 'meta'],
  types: ['tv'],
  catalogs: [
    {
      type: 'tv',
      id: 'calcio_tv_ita',
      name: 'Calcio TV Italia',
      extra: [{ name: 'search', isRequired: false }],
    },
  ],
  idPrefixes: ['calciotvita_'],
  behaviorHints: {
    configurable: false,
  },
};
