// Manifest protocollo Stremio/Nuvio.
//
// Note di design (imparate sul campo):
// - La ricerca testuale in Stremio/Nuvio è di fatto limitata ai tipi
//   movie/series: su un catalogo di tipo "tv" non viene esposta. Per questo
//   il filtro utile qui è "genre" (competizione), che l'app mostra come
//   menù a tendina sopra il catalogo.
// - `isRequired: false` è essenziale: con la ricerca obbligatoria il catalogo
//   non compare affatto nella schermata principale.

const COMPETITIONS = [
  'Serie A',
  'Serie B',
  'Coppa Italia',
  'Champions League',
  'Europa League',
  'Conference League',
  'La Liga',
  'Premier League',
  'Bundesliga',
  'Ligue 1',
  'Campionato Portoghese',
  'Amichevole',
];

module.exports = {
  id: 'org.marco.calciotvita',
  version: '1.2.0',
  name: 'Calcio TV Italia',
  description:
    'Partite di calcio con canale/piattaforma italiana e data. Filtra per competizione. Dati canale da calciointv.com (fonte non ufficiale, best-effort).',
  logo: 'https://www.thesportsdb.com/images/logo-back.png',
  resources: ['catalog', 'meta'],
  types: ['tv'],
  catalogs: [
    {
      type: 'tv',
      id: 'calcio_tv_ita',
      name: 'Calcio TV Italia',
      extra: [
        { name: 'genre', isRequired: false, options: COMPETITIONS },
        { name: 'search', isRequired: false },
      ],
      genres: COMPETITIONS,
    },
  ],
  idPrefixes: ['calciotvita_'],
  behaviorHints: {
    configurable: false,
  },
};

module.exports.COMPETITIONS = COMPETITIONS;
