/* ========================================
   HUMEWOOD SWINGERS — APP.JS
   Google Sheets–powered version
   ======================================== */

const PASSWORD = 'belekker';
let _authed = false;

// ============ GOOGLE SHEETS CONFIG ============
// To connect your Google Sheets:
// 1. Create a Google Sheet with two tabs: "Individual" and "Teams"
// 2. Share the sheet as "Anyone with the link can view"
// 3. Go to File > Share > Publish to the web > select each sheet > CSV > Publish
// 4. Paste your Sheet ID below (the long string from the sheet URL)
//
// Sheet URL format: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
// Individual sheet columns: Player, Team, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10
// Teams sheet columns: Team, Captain, Sponsor, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10

const SHEETS_CONFIG = {
  sheetId: '1TrjUcjOE0h7GrmorqUDDN729sqYq96ZzGNGnnJ28BaA',
  individualTab: 'Individual',
  teamsTab: 'Teams',
  prizesTab: 'Prizes',
  // GID fallbacks — used when tab-name lookup returns wrong data
  individualGid: '2004728485',
  teamsGid: '1193974316',
  prizesGid: '2022812007',
};

// ============ STATIC DATA ============
const TEAM_LOGOS = {
  'Bogey Boys': 'images/bogey-boys.jpg',
  'Fairway Bandits': 'images/fairway-bandits.jpg',
  'Tees and Treats': 'images/tees-and-treats.jpg',
  'Divot Dogs': 'images/divot-dogs.jpg',
};

const TEAM_ORDER = ['Bogey Boys', 'Fairway Bandits', 'Tees and Treats', 'Divot Dogs'];

// Normalize team names — strips "Klipdrift" prefix if present in the sheet
function normalizeTeamName(name) {
  if (!name) return '';
  return name.replace(/^Klipdrift\s+/i, '').trim();
}

const ROUND_DATES = {
  1: '14/03/2026',
  2: 'TBD', 3: 'TBD', 4: 'TBD', 5: 'TBD',
  6: 'TBD', 7: 'TBD', 8: 'TBD', 9: 'TBD', 10: 'TBD',
};

let playersData = [];
let teamsData = [];
let prizesData = [];

// ============ AUTH ============
function checkAuth() {
  return _authed;
}

function initGate() {
  const gate = document.getElementById('password-gate');
  const input = document.getElementById('gate-password');
  const btn = document.getElementById('gate-submit');
  const error = document.getElementById('gate-error');

  if (checkAuth()) {
    gate.style.display = 'none';
    showApp();
    return;
  }

  function tryPassword() {
    const val = input.value.trim().toLowerCase();
    if (val === PASSWORD) {
      _authed = true;
      gate.classList.add('gate-exit');
      setTimeout(() => {
        gate.style.display = 'none';
        showApp();
      }, 400);
    } else {
      error.textContent = val === '' ? 'Come on, give it a go...' : "Not so lekker... try again";
      input.value = '';
      input.focus();
      gate.classList.add('shake');
      setTimeout(() => gate.classList.remove('shake'), 500);
    }
  }

  btn.addEventListener('click', tryPassword);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryPassword();
  });
}

function showApp() {
  document.getElementById('main-app').classList.add('visible');
  initNav();
  loadData();
  initScrollAnimations();
  if (isAdmin()) {
    document.getElementById('admin-panel').classList.add('visible');
    // Set the Google Sheets link
    const sheetsLink = document.getElementById('admin-sheets-link');
    if (sheetsLink && SHEETS_CONFIG.sheetId) {
      sheetsLink.href = `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.sheetId}/edit`;
    } else if (sheetsLink) {
      sheetsLink.href = '#';
      sheetsLink.textContent = '⚠ No Sheet ID configured yet';
      sheetsLink.style.opacity = '0.5';
      sheetsLink.style.pointerEvents = 'none';
    }
  }
}

function isAdmin() {
  return new URLSearchParams(window.location.search).get('admin') === 'true';
}

// ============ NAVIGATION ============
function initNav() {
  const nav = document.querySelector('.main-nav');
  const hamburger = document.querySelector('.nav-hamburger');
  const links = document.querySelector('.nav-links');
  const allLinks = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    updateActiveLink();
  });

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    links.classList.toggle('open');
  });

  allLinks.forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      links.classList.remove('open');
    });
  });

  document.querySelectorAll('.hero-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const target = card.getAttribute('href');
      if (target) {
        document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

function updateActiveLink() {
  const sections = document.querySelectorAll('.section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  let current = '';

  sections.forEach(section => {
    const top = section.offsetTop - 100;
    if (window.scrollY >= top) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
}

// ============ CSV PARSER ============
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row — handle quoted values
  const headers = parseCSVRow(lines[0]).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVRow(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    // Also store by column index for positional access
    values.forEach((v, idx) => {
      row[`_col${idx}`] = (v || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ============ GOOGLE SHEETS FETCH ============
function getSheetURL(tabName) {
  if (!SHEETS_CONFIG.sheetId) return null;
  return `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

function getSheetURLByGid(gid) {
  if (!SHEETS_CONFIG.sheetId || !gid) return null;
  return `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

async function fetchSheetData(tabName, gid) {
  const url = getSheetURL(tabName);
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    // If rows look valid (or no GID fallback), return them
    if (rows && rows.length > 0) return rows;
    return null;
  } catch (e) {
    console.warn(`Could not fetch "${tabName}" sheet:`, e.message);
  }

  // Try GID fallback
  if (gid) {
    try {
      const gidUrl = getSheetURLByGid(gid);
      const response = await fetch(gidUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      return parseCSV(csvText);
    } catch (e2) {
      console.warn(`GID fallback for "${tabName}" also failed:`, e2.message);
    }
  }
  return null;
}

// Fuzzy column lookup — tries exact match, prefix match, then falls back to column index
function getCol(row, prefix, colIndex) {
  // Exact match first
  if (row[prefix] !== undefined && row[prefix] !== '') return row[prefix];
  // Try trimmed/prefix match
  const trimmed = prefix.trim();
  for (const key of Object.keys(row)) {
    if (key.startsWith('_col')) continue; // skip positional keys
    const k = key.trim();
    if (k === trimmed) return row[key];
    if (k.startsWith(trimmed)) return row[key];
  }
  // Fall back to column index
  if (colIndex !== undefined && row[`_col${colIndex}`] !== undefined) {
    return row[`_col${colIndex}`];
  }
  return '';
}

// Individual sheet: col0=Player, col1=Team, col2=R1, col3=R2, ... col11=R10
function sheetRowToPlayer(row) {
  const rounds = {};
  for (let r = 1; r <= 10; r++) {
    const val = getCol(row, `R${r}`, r + 1);
    if (val != null && val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) rounds[r] = num;
    }
  }
  return {
    name: getCol(row, 'Player', 0) || '',
    team: normalizeTeamName(getCol(row, 'Team', 1) || ''),
    rounds,
  };
}

// Teams sheet: col0=Team, col1=Captain, col2=Sponsor, col3=R1, col4=R2, ... col12=R10
function sheetRowToTeam(row) {
  const rounds = {};
  for (let r = 1; r <= 10; r++) {
    const val = getCol(row, `R${r}`, r + 2);
    if (val != null && val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) rounds[r] = num;
    }
  }

  const teamName = normalizeTeamName(getCol(row, 'Team', 0) || '');

  // Build members list from playersData (already loaded)
  const members = playersData
    .filter(p => p.team === teamName)
    .map(p => p.name);

  return {
    name: teamName,
    captain: getCol(row, 'Captain', 1) || '',
    sponsor: getCol(row, 'Sponsor', 2) || '',
    rounds,
    members,
  };
}

// ============ DATA LOADING ============
async function loadData() {
  // Always start with fallback so something renders immediately
  useFallbackData();
  renderScoreboard();
  renderAttendance();
  renderTeams();
  renderPrizes();

  // If Google Sheets is configured, try to fetch live data
  if (SHEETS_CONFIG.sheetId) {
    showDataStatus('loading');

    try {
      // Fetch individual scores first (needed for team member lists)
      const individualRows = await fetchSheetData(SHEETS_CONFIG.individualTab, SHEETS_CONFIG.individualGid);
      if (individualRows && individualRows.length > 0) {
        playersData = individualRows.map(sheetRowToPlayer).filter(p => p.name);
      }

      // Fetch team scores
      const teamRows = await fetchSheetData(SHEETS_CONFIG.teamsTab, SHEETS_CONFIG.teamsGid);
      if (teamRows && teamRows.length > 0) {
        teamsData = teamRows.map(sheetRowToTeam).filter(t => t.name);
      }

      // Fetch prizes — try by tab name first, validate, fall back to GID
      let prizesRows = await fetchSheetData(SHEETS_CONFIG.prizesTab);
      if (prizesRows && prizesRows.length > 0 && !looksLikePrizesData(prizesRows)) {
        // Tab name returned wrong data (e.g. trailing space in tab name) — try GID
        console.warn('Prizes tab name returned wrong data, trying GID fallback...');
        prizesRows = null;
      }
      if (!prizesRows && SHEETS_CONFIG.prizesGid) {
        const gidUrl = getSheetURLByGid(SHEETS_CONFIG.prizesGid);
        try {
          const resp = await fetch(gidUrl);
          if (resp.ok) {
            const csvText = await resp.text();
            prizesRows = parseCSV(csvText);
          }
        } catch (e) {
          console.warn('Prizes GID fetch failed:', e.message);
        }
      }
      if (prizesRows && prizesRows.length > 0 && looksLikePrizesData(prizesRows)) {
        prizesData = prizesRows.map(sheetRowToPrize).filter(p => p.round);
      } else {
        prizesData = [];
        console.warn('Prizes tab not found or returned wrong data — showing empty prizes');
      }

      renderScoreboard();
      renderAttendance();
      renderTeams();
      renderPrizes();
      showDataStatus('live');
    } catch (e) {
      console.warn('Sheets fetch failed, using fallback data:', e.message);
      showDataStatus('fallback');
    }
  } else {
    showDataStatus('fallback');
  }
}

function showDataStatus(status) {
  // Remove any existing status badge
  const existing = document.querySelector('.data-status-badge');
  if (existing) existing.remove();

  const scoreboard = document.getElementById('scoreboard');
  if (!scoreboard) return;

  const badge = document.createElement('div');
  badge.className = 'data-status-badge';

  if (status === 'loading') {
    badge.innerHTML = '<span class="status-dot loading"></span> Loading live data...';
  } else if (status === 'live') {
    badge.innerHTML = '<span class="status-dot live"></span> Live from Google Sheets';
    // Auto-hide after 4 seconds
    setTimeout(() => badge.classList.add('fade-out'), 4000);
    setTimeout(() => badge.remove(), 4500);
  } else {
    badge.innerHTML = '<span class="status-dot fallback"></span> Showing sample data';
  }

  const sectionTitle = scoreboard.querySelector('.section-title');
  if (sectionTitle) {
    sectionTitle.parentNode.insertBefore(badge, sectionTitle.nextSibling);
  }
}

function useFallbackData() {
  const r1Scores = {
    "Aidan Rijs": 32, "Alex Crossley": 38, "Andre Le Clair": 29,
    "Andrew Stidworthy": 35, "Andrew McIntosh": 31, "Bradley Bester": 27,
    "Brent Kotze": 34, "Calvin Bekker": 30, "Christopher Ryan": 36,
    "Damian Bailey": 33, "Daniel Clarke": 28, "David Lester": 37,
    "Garth Holder": 35, "Ian Stapleton": 31, "Jason van der Merwe": 39,
    "Joe Scott": 26, "Justin Heathcote": 34, "Lloyd Gravett": 30,
    "Lukas Rabentisch": 32, "Luke Groth": 28, "Marc Stone": 36,
    "Michael Gunton": 33, "Nathan Beaumont": 29, "Nicholas Cameron": 35,
    "Mark Porter": 31, "Raymond Zambon": 27, "Reyneke Engelbrecht": 34,
    "Ricardo Brocco": 30, "Richard De Freitas": 33, "Stephen Winter": 32,
    "Steve Tindall": 37, "Thomas Kitwood": 28, "Wynand Oosterhuizen": 31,
  };

  const teamAssignments = {
    "Bogey Boys": ["Thomas Kitwood", "Luke Groth", "David Lester", "Ian Stapleton", "Richard De Freitas", "Brent Kotze", "Lloyd Gravett", "Garth Holder"],
    "Fairway Bandits": ["Justin Heathcote", "Michael Gunton", "Stephen Winter", "Andre Le Clair", "Nicholas Cameron", "Raymond Zambon", "Wynand Oosterhuizen", "Daniel Clarke", "Steve Tindall"],
    "Tees and Treats": ["Damian Bailey", "Bradley Bester", "Reyneke Engelbrecht", "Mark Porter", "Andrew McIntosh", "Ricardo Brocco", "Joe Scott", "Marc Stone"],
    "Divot Dogs": ["Andrew Stidworthy", "Jason van der Merwe", "Christopher Ryan", "Aidan Rijs", "Calvin Bekker", "Nathan Beaumont", "Lukas Rabentisch", "Alex Crossley"],
  };

  const playerTeam = {};
  Object.entries(teamAssignments).forEach(([team, members]) => {
    members.forEach(m => { playerTeam[m] = team; });
  });

  playersData = Object.entries(r1Scores).map(([name, score]) => ({
    name,
    team: playerTeam[name] || '',
    rounds: { 1: score },
  }));

  teamsData = [
    { name: "Bogey Boys", captain: "Garth Holder", sponsor: "Oolaa Group", rounds: { 1: 289 }, members: teamAssignments["Bogey Boys"] },
    { name: "Fairway Bandits", captain: "Steve Tindall", sponsor: "Cooshti", rounds: { 1: 294 }, members: teamAssignments["Fairway Bandits"] },
    { name: "Tees and Treats", captain: "Marc Stone", sponsor: "Ask For Alonzo", rounds: { 1: 287 }, members: teamAssignments["Tees and Treats"] },
    { name: "Divot Dogs", captain: "Alex Crossley", sponsor: "Frites Belgium on Tap", rounds: { 1: 291 }, members: teamAssignments["Divot Dogs"] },
  ];
}

// ============ SCOREBOARD ============
function calcBest5(rounds) {
  const scores = [];
  for (let r = 1; r <= 10; r++) {
    const val = rounds[r] || rounds[String(r)];
    if (val != null && val !== '' && val !== 0) {
      scores.push(Number(val));
    }
  }
  if (scores.length === 0) return 0;
  scores.sort((a, b) => b - a);
  return scores.slice(0, 5).reduce((sum, s) => sum + s, 0);
}

function renderScoreboard() {
  const tbody = document.getElementById('scoreboard-body');
  if (!tbody) return;

  const sorted = playersData.map(p => ({
    ...p,
    best5: calcBest5(p.rounds),
  })).sort((a, b) => b.best5 - a.best5);

  tbody.innerHTML = sorted.map((p, i) => {
    const rank = i + 1;
    let rankClass = '';
    let rankDisplay = rank;
    if (rank === 1) { rankClass = 'rank-1'; rankDisplay = '<span class="rank-medal">&#127942;</span>'; }
    else if (rank === 2) { rankClass = 'rank-2'; rankDisplay = '<span class="rank-medal">&#129352;</span>'; }
    else if (rank === 3) { rankClass = 'rank-3'; rankDisplay = '<span class="rank-medal">&#129353;</span>'; }

    let roundCells = '';
    for (let r = 1; r <= 10; r++) {
      const val = p.rounds[r] || p.rounds[String(r)];
      if (val != null && val !== '' && val !== 0) {
        roundCells += `<td>${val}</td>`;
      } else {
        roundCells += `<td class="score-empty">-</td>`;
      }
    }

    const teamLogo = TEAM_LOGOS[p.team] || '';
    const teamBadge = teamLogo
      ? `<img src="${teamLogo}" alt="${p.team}" class="scoreboard-team-logo" title="${p.team}">`
      : (p.team ? `<span class="scoreboard-team-name" title="${p.team}">${p.team.split(' ').map(w => w[0]).join('')}</span>` : '');

    return `<tr class="${rankClass}">
      <td class="rank-cell">${rankDisplay}</td>
      <td class="player-cell"><span class="player-name">${p.name}</span>${teamBadge}</td>
      ${roundCells}
      <td class="best5">${p.best5 || '-'}</td>
    </tr>`;
  }).join('');
}

// ============ ATTENDANCE ============
function renderAttendance() {
  const tbody = document.getElementById('attendance-body');
  if (!tbody) return;

  const sorted = [...playersData].sort((a, b) => a.name.localeCompare(b.name));

  tbody.innerHTML = sorted.map(p => {
    let total = 0;
    let cells = '';
    for (let r = 1; r <= 10; r++) {
      const val = p.rounds[r] || p.rounds[String(r)];
      const attended = val != null && val !== '' && val !== 0 && !isNaN(Number(val)) && Number(val) > 0;
      if (attended) total++;
      cells += attended
        ? '<td class="att-yes">&#10003;</td>'
        : '<td class="att-no">&mdash;</td>';
    }
    return `<tr>
      <td class="att-player">${p.name}</td>
      ${cells}
      <td class="att-total">${total}/10</td>
    </tr>`;
  }).join('');
}

// ============ TEAMS ============
function renderTeams() {
  renderTeamStandings();
  renderTeamCards();
}

function getTeamTotal(team) {
  let total = 0;
  for (let r = 1; r <= 10; r++) {
    const val = team.rounds[r] || team.rounds[String(r)];
    if (val != null && val !== '' && val !== 0) {
      total += Number(val);
    }
  }
  return total;
}

function renderTeamStandings() {
  const container = document.getElementById('team-standings');
  if (!container) return;

  const sorted = [...teamsData].map(t => ({
    ...t,
    total: getTeamTotal(t),
  })).sort((a, b) => a.total - b.total);

  container.innerHTML = sorted.map((t, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'rank-1-team' : '';
    return `<div class="team-standing-card ${rankClass}">
      <div class="team-standing-rank">#${rank}</div>
      <div class="team-standing-name">${t.name}</div>
      <div class="team-standing-score">Net Total: <strong>${t.total}</strong></div>
    </div>`;
  }).join('');
}

function renderTeamCards() {
  const container = document.getElementById('team-cards');
  if (!container) return;

  container.innerHTML = TEAM_ORDER.map(teamName => {
    const team = teamsData.find(t => t.name === teamName);
    if (!team) return '';

    const logo = TEAM_LOGOS[teamName] || '';
    const total = getTeamTotal(team);

    let scoreRows = '';
    for (let r = 1; r <= 10; r++) {
      const val = team.rounds[r] || team.rounds[String(r)];
      if (val != null && val !== '' && val !== 0) {
        scoreRows += `<div class="team-score-row">
          <span class="team-score-label">Round ${r}</span>
          <span class="team-score-value">${val}</span>
        </div>`;
      }
    }

    const members = (team.members || []).filter(m => m !== team.captain);

    return `<div class="team-card">
      <div class="team-card-header">
        <img src="${logo}" alt="${teamName}" class="team-card-logo" loading="lazy">
        <div class="team-card-name">${teamName}</div>
        <div class="team-card-captain">Captain: ${team.captain}</div>
        <div class="team-card-sponsor">Sponsored by ${team.sponsor}</div>
      </div>
      <div class="team-card-body">
        <div class="team-members-title">Squad</div>
        <ul class="team-members-list">
          ${members.map(m => `<li>${m}</li>`).join('')}
        </ul>
        <div class="team-scores-section">
          ${scoreRows}
          <div class="team-score-row team-total-row">
            <span class="team-score-label">Total Net</span>
            <span class="team-score-value">${total}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============ PRIZES ============
// Prizes sheet: col0=Round, col1=Pink Jacket, col2=Blue Jackets, col3=Closest to Pin, col4=Longest Drive, col5=2 Club, col6=Jackpot

// Validate that fetched data looks like prizes and not another tab's data
function looksLikePrizesData(rows) {
  if (!rows || rows.length === 0) return false;
  const firstRow = rows[0];
  const headers = Object.keys(firstRow).filter(k => !k.startsWith('_col'));

  // Check if any header contains prize-related keywords
  const prizeKeywords = ['round', 'jacket', 'closest', 'longest', 'drive', 'pin', 'prize', '2 club', 'jackpot'];
  const hasPrizeHeader = headers.some(h =>
    prizeKeywords.some(kw => h.toLowerCase().includes(kw))
  );
  if (hasPrizeHeader) return true;

  // Check positional: first column should look like "Round X" or a number
  const col0 = (firstRow._col0 || '').trim().toLowerCase();
  if (/^round\s*\d/i.test(col0) || /^\d+$/.test(col0)) return true;

  // If col0 looks like a player name (more than one word, no "round"), it's wrong data
  // Also reject if headers contain player/team keywords
  const badKeywords = ['player', 'team', 'captain', 'sponsor'];
  const hasBadHeader = headers.some(h =>
    badKeywords.some(kw => h.toLowerCase().includes(kw))
  );
  if (hasBadHeader) return false;

  // If there are 12+ columns (like individual leaderboard), it's wrong
  const colCount = Object.keys(firstRow).filter(k => k.startsWith('_col')).length;
  if (colCount > 10) return false;

  // Default: accept (benefit of the doubt for custom headers)
  return true;
}

function sheetRowToPrize(row) {
  return {
    round: getCol(row, 'Round', 0) || '',
    pinkJacket: getCol(row, 'Pink Jacket', 1) || '',
    blueJackets: getCol(row, 'Blue Jackets', 2) || '',
    longestDrive: getCol(row, 'Longest Drive', 3) || '',
    closestPin: getCol(row, 'Closest to', 4) || '',
    twoClub: getCol(row, '2 Club', 5) || '',
    jackpot: getCol(row, 'Jackpot', 6) || '',
  };
}

function renderPrizes() {
  const tbody = document.getElementById('prizes-body');
  if (!tbody) return;

  // If we have data from the sheet, use it. Otherwise show 10 empty rounds.
  const data = prizesData.length > 0 ? prizesData : Array.from({ length: 10 }, (_, i) => ({
    round: `Round ${i + 1}`,
    pinkJacket: '',
    blueJackets: '',
    closestPin: '',
    longestDrive: '',
    twoClub: '',
    jackpot: '',
  }));

  tbody.innerHTML = data.map(p => {
    const empty = (val) => val ? val.trim() : '<span class="prize-empty">&mdash;</span>';
    const roundNum = parseInt(p.round.toString().replace(/\D/g, ''), 10);
    const roundDate = ROUND_DATES[roundNum] || '';
    // Ensure "Round X" prefix
    const roundText = /^round/i.test(p.round) ? p.round : (roundNum ? `Round ${roundNum}` : p.round);
    const roundLabel = roundDate && roundDate !== 'TBD' ? `${roundText} <span style="font-weight:400;color:var(--text-muted);font-size:0.75rem;">(${roundDate})</span>` : roundText;

    return `<tr>
      <td class="round-cell">${roundLabel}</td>
      <td>${empty(p.pinkJacket)}</td>
      <td>${empty(p.blueJackets)}</td>
      <td>${empty(p.closestPin)}</td>
      <td>${empty(p.longestDrive)}</td>
      <td>${empty(p.twoClub)}</td>
      <td>${empty(p.jackpot)}</td>
    </tr>`;
  }).join('');
}

// ============ SCROLL ANIMATIONS ============
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
  });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  initGate();
});
