// Codifica/decodifica dell'id evento usato nel protocollo Stremio/Nuvio.
// Formato: calciotvita_<base64url(date|home|away)>
const PREFIX = 'calciotvita_';

function encodeEventId(ev) {
  const raw = `${ev.date || ''}|${ev.home || ''}|${ev.away || ''}`;
  return PREFIX + Buffer.from(raw, 'utf8').toString('base64url');
}

function decodeEventId(id) {
  if (!id || !id.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(id.slice(PREFIX.length), 'base64url').toString('utf8');
    const [date, home, away] = raw.split('|');
    return { date, home, away };
  } catch (err) {
    return null;
  }
}

module.exports = { encodeEventId, decodeEventId, PREFIX };
