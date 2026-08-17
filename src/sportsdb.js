// Client TheSportsDB (free tier, key pubblica "123")
// Doc: https://www.thesportsdb.com/documentation
const axios = require('axios');

const SPORTSDB_KEY = process.env.SPORTSDB_KEY || '123';
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;

async function searchTeams(name) {
  const { data } = await axios.get(`${BASE}/searchteams.php`, { params: { t: name } });
  return data.teams || [];
}

async function searchEvents(name) {
  // searchevents.php cerca per "Squadra1_vs_Squadra2" o nome evento
  const { data } = await axios.get(`${BASE}/searchevents.php`, { params: { e: name } });
  return data.event || [];
}

async function eventsNextByTeam(teamId) {
  const { data } = await axios.get(`${BASE}/eventsnext.php`, { params: { id: teamId } });
  return data.events || [];
}

async function eventsLastByTeam(teamId) {
  const { data } = await axios.get(`${BASE}/eventslast.php`, { params: { id: teamId } });
  return data.results || [];
}

async function eventsDay(dateStr) {
  // dateStr formato YYYY-MM-DD
  const { data } = await axios.get(`${BASE}/eventsday.php`, { params: { d: dateStr, s: 'Soccer' } });
  return data.events || [];
}

module.exports = {
  searchTeams,
  searchEvents,
  eventsNextByTeam,
  eventsLastByTeam,
  eventsDay,
};
