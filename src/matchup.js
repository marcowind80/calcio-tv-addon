// Combina i dati TheSportsDB (squadre/eventi/date) con i dati scrapati
// (canale/piattaforma italiana) in un unico oggetto "evento arricchito".
const sportsdb = require('./sportsdb');
const scraper = require('./scraper');

function formatDate(dateStr, timeStr) {
  if (!dateStr) return null;
  return timeStr ? `${dateStr} ${timeStr}` : dateStr;
}

// Cerca per nome squadra: prende i prossimi eventi da TheSportsDB e per
// ciascuno prova ad arricchirlo con canale/piattaforma dallo scraper.
async function getUpcomingByTeam(teamName) {
  const teams = await sportsdb.searchTeams(teamName);
  const soccerTeams = (teams || []).filter((t) => t.strSport === 'Soccer');
  if (!soccerTeams.length) {
    return { found: false, reason: 'team_not_found', query: teamName };
  }

  const team = soccerTeams[0];
  const nextEvents = await sportsdb.eventsNextByTeam(team.idTeam);

  const scrapedForTeam = await scraper.findEventsByTeamName(teamName).catch(() => []);

  const enriched = (nextEvents || []).map((ev) => {
    const home = ev.strHomeTeam;
    const away = ev.strAwayTeam;
    const homeNorm = scraper.normalizeTeamName(home);
    const awayNorm = scraper.normalizeTeamName(away);

    const scrapedMatch = scrapedForTeam.find(
      (s) =>
        (s.homeNorm.includes(homeNorm) || homeNorm.includes(s.homeNorm)) &&
        (s.awayNorm.includes(awayNorm) || awayNorm.includes(s.awayNorm))
    );

    return {
      idEvent: ev.idEvent,
      home,
      away,
      league: ev.strLeague,
      dateEvent: ev.dateEvent,
      timeEvent: ev.strTime,
      dateFormatted: formatDate(ev.dateEvent, ev.strTime),
      italianChannel: scrapedMatch ? scrapedMatch.channel : null,
      channelSource: scrapedMatch ? 'calciointv.com' : null,
      matchFound: Boolean(scrapedMatch),
    };
  });

  return {
    found: true,
    team: { id: team.idTeam, name: team.strTeam, badge: team.strTeamBadge },
    events: enriched,
  };
}

// Cerca un singolo evento dato "Squadra1 vs Squadra2" o simile
async function getEventByMatchup(teamA, teamB) {
  const [teamsA, teamsB] = await Promise.all([
    sportsdb.searchTeams(teamA),
    sportsdb.searchTeams(teamB),
  ]);

  const tA = (teamsA || []).find((t) => t.strSport === 'Soccer');
  const tB = (teamsB || []).find((t) => t.strSport === 'Soccer');

  let nextEvents = [];
  if (tA) nextEvents = await sportsdb.eventsNextByTeam(tA.idTeam);

  const match = (nextEvents || []).find((ev) => {
    const h = scraper.normalizeTeamName(ev.strHomeTeam);
    const a = scraper.normalizeTeamName(ev.strAwayTeam);
    const bNorm = scraper.normalizeTeamName(teamB);
    return h.includes(bNorm) || a.includes(bNorm) || bNorm.includes(h) || bNorm.includes(a);
  });

  const scrapedMatch = await scraper.findEventByMatchup(teamA, teamB).catch(() => null);

  if (!match && !scrapedMatch) {
    return { found: false, reason: 'event_not_found', query: `${teamA} vs ${teamB}` };
  }

  return {
    found: true,
    home: match ? match.strHomeTeam : (scrapedMatch ? scrapedMatch.home : teamA),
    away: match ? match.strAwayTeam : (scrapedMatch ? scrapedMatch.away : teamB),
    league: match ? match.strLeague : (scrapedMatch ? scrapedMatch.competition : null),
    dateEvent: match ? match.dateEvent : (scrapedMatch ? scrapedMatch.date : null),
    timeEvent: match ? match.strTime : (scrapedMatch ? scrapedMatch.time : null),
    italianChannel: scrapedMatch ? scrapedMatch.channel : null,
    channelSource: scrapedMatch ? 'calciointv.com' : null,
  };
}

module.exports = { getUpcomingByTeam, getEventByMatchup };
