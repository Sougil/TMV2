// ===================================
// Pétanque Tournament Manager
// ===================================

class TournamentManager {
    constructor() {
        this.players = [];
        this.tournamentType = 'doublette';
        this.numRounds = 5;
        this.firstTerrain = 1;
        this.skipTerrain = false;
        this.rounds = [];
        this.currentRound = 0;
        this.viewMode = 'detailed'; // 'detailed' or 'condensed'

        this.initializeEventListeners();
        this.loadFromLocalStorage();
    }

    // ===================================
    // Initialization
    // ===================================

    initializeEventListeners() {
        document.getElementById('csv-upload').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('tournament-type').addEventListener('change', (e) => {
            this.tournamentType = e.target.value;
            this.updateStartButtonState();
        });
        document.getElementById('num-rounds').addEventListener('change', (e) => {
            this.numRounds = parseInt(e.target.value);
            this.updateStartButtonState();
        });
        document.getElementById('first-terrain').addEventListener('change', (e) => {
            this.firstTerrain = parseInt(e.target.value);
        });
        document.getElementById('skip-terrain').addEventListener('change', (e) => {
            this.skipTerrain = e.target.checked;
        });
        document.getElementById('start-tournament-btn').addEventListener('click', () => this.startTournament());
        document.getElementById('new-tournament-btn').addEventListener('click', () => this.newTournament());
    }

    // ===================================
    // CSV Parsing
    // ===================================

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.parseCSV(content);
        };
        reader.readAsText(file);
    }

    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        this.players = [];

        lines.forEach((line, index) => {
            const parts = line.split(/[,;]/).map(p => p.trim());
            if (parts.length >= 2) {
                const lastName = parts[0];
                const firstName = parts[1];
                this.players.push({
                    id: index,
                    lastName,
                    firstName,
                    fullName: `${firstName} ${lastName}`,
                    wins: 0,
                    pointsFor: 0,
                    pointsAgainst: 0,
                    goalAverage: 0
                });
            }
        });

        this.displayPlayerPreview();
        this.updateStartButtonState();
    }

    displayPlayerPreview() {
        const preview = document.getElementById('player-preview');
        const playerList = document.getElementById('player-list');
        const playerCount = document.getElementById('player-count');

        if (this.players.length === 0) {
            preview.classList.add('hidden');
            return;
        }

        preview.classList.remove('hidden');
        playerCount.textContent = this.players.length;

        playerList.innerHTML = this.players
            .map(p => `<span class="player-tag">${p.fullName}</span>`)
            .join(' ');
    }

    updateStartButtonState() {
        const btn = document.getElementById('start-tournament-btn');
        const playersPerTeam = this.tournamentType === 'triplette' ? 3 : 2;
        const minPlayers = playersPerTeam * 2;

        btn.disabled = this.players.length < minPlayers || this.numRounds < 1;
    }

    // ===================================
    // Tournament Generation
    // ===================================

    startTournament() {
        this.rounds = [];
        this.firstTerrain = parseInt(document.getElementById('first-terrain').value);
        this.skipTerrain = document.getElementById('skip-terrain').checked;
        this.generateAllRounds();
        this.saveToLocalStorage();
        this.displayTournament();

        // Show new tournament button
        document.getElementById('new-tournament-btn').style.display = 'block';
    }

    generateAllRounds() {
        const playersPerTeam = this.tournamentType === 'triplette' ? 3 : 2;
        const playerHistory = new Map(); // Track who played with/against whom

        // Initialize history
        this.players.forEach(p => {
            playerHistory.set(p.id, { partners: new Set(), opponents: new Set() });
        });

        for (let round = 0; round < this.numRounds; round++) {
            const matches = this.generateRound(playersPerTeam, playerHistory);
            this.rounds.push({
                roundNumber: round + 1,
                matches: matches
            });
        }
    }

    generateRound(playersPerTeam, playerHistory) {
        const availablePlayers = [...this.players];
        const matches = [];
        let matchNumber = 1;

        // Shuffle players for randomness
        this.shuffleArray(availablePlayers);

        while (availablePlayers.length >= playersPerTeam * 2) {
            // Try to find the best team composition
            const team1 = this.selectTeam(availablePlayers, playersPerTeam, playerHistory);
            const team2 = this.selectTeam(availablePlayers, playersPerTeam, playerHistory);

            if (team1.length === playersPerTeam && team2.length === playersPerTeam) {
                // Update history
                this.updateHistory(team1, team2, playerHistory);

                // Calculate terrain number
                const terrainNumber = this.calculateTerrainNumber(matches.length);

                matches.push({
                    matchNumber: matchNumber++,
                    terrainNumber: terrainNumber,
                    team1: team1,
                    team2: team2,
                    winner: null,
                    scoreTeam1: null,
                    scoreTeam2: null
                });
            } else {
                // Not enough players for another match
                break;
            }
        }

        return matches;
    }

    calculateTerrainNumber(matchIndex) {
        if (this.skipTerrain) {
            return this.firstTerrain + (matchIndex * 2);
        } else {
            return this.firstTerrain + matchIndex;
        }
    }

    selectTeam(availablePlayers, size, playerHistory) {
        if (availablePlayers.length < size) return [];

        // Simple approach: take first 'size' players that haven't played together recently
        const team = [];
        const candidates = [...availablePlayers];

        for (let i = 0; i < size && candidates.length > 0; i++) {
            let bestIndex = 0;
            let minPartnerOverlap = Infinity;

            // Find player with least overlap with current team
            for (let j = 0; j < candidates.length; j++) {
                const player = candidates[j];
                let overlap = 0;

                team.forEach(teammate => {
                    if (playerHistory.get(player.id).partners.has(teammate.id)) {
                        overlap++;
                    }
                });

                if (overlap < minPartnerOverlap) {
                    minPartnerOverlap = overlap;
                    bestIndex = j;
                }
            }

            team.push(candidates[bestIndex]);
            candidates.splice(bestIndex, 1);
        }

        // Remove selected players from available pool
        team.forEach(player => {
            const index = availablePlayers.findIndex(p => p.id === player.id);
            if (index !== -1) availablePlayers.splice(index, 1);
        });

        return team;
    }

    updateHistory(team1, team2, playerHistory) {
        // Mark team1 players as partners
        for (let i = 0; i < team1.length; i++) {
            for (let j = i + 1; j < team1.length; j++) {
                playerHistory.get(team1[i].id).partners.add(team1[j].id);
                playerHistory.get(team1[j].id).partners.add(team1[i].id);
            }
        }

        // Mark team2 players as partners
        for (let i = 0; i < team2.length; i++) {
            for (let j = i + 1; j < team2.length; j++) {
                playerHistory.get(team2[i].id).partners.add(team2[j].id);
                playerHistory.get(team2[j].id).partners.add(team2[i].id);
            }
        }

        // Mark cross-team as opponents
        team1.forEach(p1 => {
            team2.forEach(p2 => {
                playerHistory.get(p1.id).opponents.add(p2.id);
                playerHistory.get(p2.id).opponents.add(p1.id);
            });
        });
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // ===================================
    // UI Display
    // ===================================

    displayTournament() {
        document.getElementById('config-section').classList.add('hidden');
        document.getElementById('tournament-section').classList.remove('hidden');

        this.createTabs();
        this.createTabContents();
        this.showTab(0);
    }

    createTabs() {
        const tabsContainer = document.getElementById('tabs-container');
        tabsContainer.innerHTML = '';

        // Round tabs
        this.rounds.forEach((round, index) => {
            const tab = document.createElement('div');
            tab.className = 'tab';
            tab.textContent = `Partie ${round.roundNumber}`;
            tab.addEventListener('click', () => this.showTab(index));
            tabsContainer.appendChild(tab);
        });

        // Rankings tab
        const rankingsTab = document.createElement('div');
        rankingsTab.className = 'tab';
        rankingsTab.textContent = '🏆 Classement';
        rankingsTab.addEventListener('click', () => this.showTab(this.rounds.length));
        tabsContainer.appendChild(rankingsTab);
    }

    createTabContents() {
        const tabContents = document.getElementById('tab-contents');
        tabContents.innerHTML = '';

        // Round contents
        this.rounds.forEach((round, index) => {
            const content = document.createElement('div');
            content.className = 'tab-content';
            content.id = `round-${index}`;
            content.innerHTML = this.generateRoundHTML(round, index);
            tabContents.appendChild(content);
        });

        // Rankings content
        const rankingsContent = document.createElement('div');
        rankingsContent.className = 'tab-content';
        rankingsContent.id = 'rankings';
        rankingsContent.innerHTML = this.generateRankingsHTML();
        tabContents.appendChild(rankingsContent);
    }

    generateRoundHTML(round, roundIndex) {
        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0;">Partie ${round.roundNumber}</h2>
                    <div class="view-toggle-container">
                        <button class="view-toggle-btn ${this.viewMode === 'detailed' ? 'active' : ''}"
                                onclick="tournamentManager.toggleView('detailed', ${roundIndex})">
                            📋 Vue détaillée
                        </button>
                        <button class="view-toggle-btn ${this.viewMode === 'condensed' ? 'active' : ''}"
                                onclick="tournamentManager.toggleView('condensed', ${roundIndex})">
                            📊 Vue condensée
                        </button>
                        <button class="view-toggle-btn"
                                onclick="tournamentManager.printRound(${roundIndex})"
                                title="Imprimer les rencontres de cette partie">
                            🖨️ Imprimer
                        </button>
                    </div>
                </div>
                <div class="matches-grid ${this.viewMode === 'condensed' ? 'condensed' : ''}" id="matches-grid-${roundIndex}">
                    ${round.matches.map((match, matchIndex) => this.generateMatchHTML(match, roundIndex, matchIndex)).join('')}
                </div>
            </div>
        `;
    }

    generateMatchHTML(match, roundIndex, matchIndex) {
        const isCompleted = match.winner !== null;

        // Ultra-condensed view - read-only display
        if (this.viewMode === 'condensed') {
            return this.generateCondensedMatchHTML(match, roundIndex, matchIndex, isCompleted);
        }

        // Detailed view - full interactive
        return `
            <div class="match-card ${isCompleted ? 'completed' : ''}" id="match-${roundIndex}-${matchIndex}">
                <div class="match-number">Terrain ${match.terrainNumber} - Match ${match.matchNumber}</div>
                
                <div class="teams-container">
                    <div class="team ${match.winner === 1 ? 'winner' : ''}" 
                         onclick="tournamentManager.selectWinner(${roundIndex}, ${matchIndex}, 1)">
                        <div class="team-label">Équipe 1</div>
                        <div class="players">
                            ${match.team1.map(p => `<span class="player-tag">${p.fullName}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="team ${match.winner === 2 ? 'winner' : ''}" 
                         onclick="tournamentManager.selectWinner(${roundIndex}, ${matchIndex}, 2)">
                        <div class="team-label">Équipe 2</div>
                        <div class="players">
                            ${match.team2.map(p => `<span class="player-tag">${p.fullName}</span>`).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="score-inputs">
                    <div class="score-group">
                        <label>Score Équipe 1</label>
                        <input type="number" 
                               min="0" 
                               max="13" 
                               value="${match.scoreTeam1 ?? ''}"
                               onchange="tournamentManager.updateScore(${roundIndex}, ${matchIndex}, 1, this.value)">
                    </div>
                    <div class="score-group">
                        <label>Score Équipe 2</label>
                        <input type="number" 
                               min="0" 
                               max="13" 
                               value="${match.scoreTeam2 ?? ''}"
                               onchange="tournamentManager.updateScore(${roundIndex}, ${matchIndex}, 2, this.value)">
                    </div>
                </div>
            </div>
        `;
    }

    generateCondensedMatchHTML(match, roundIndex, matchIndex, isCompleted) {
        const score1 = match.scoreTeam1 !== null ? match.scoreTeam1 : '-';
        const score2 = match.scoreTeam2 !== null ? match.scoreTeam2 : '-';
        const winnerClass1 = match.winner === 1 ? 'winner' : '';
        const winnerClass2 = match.winner === 2 ? 'winner' : '';

        return `
            <div class="match-card-mini ${isCompleted ? 'completed' : ''}" id="match-${roundIndex}-${matchIndex}">
                <div class="match-mini-header">
                    <span class="terrain-badge">T${match.terrainNumber}</span>
                    <span class="match-mini-number">M${match.matchNumber}</span>
                </div>
                <div class="team-mini ${winnerClass1}">
                    <div class="players-mini">
                        ${match.team1.map(p => `<span>${p.firstName.charAt(0)}. ${p.lastName}</span>`).join('')}
                    </div>
                    <div class="score-mini">${score1}</div>
                </div>
                <div class="team-mini ${winnerClass2}">
                    <div class="players-mini">
                        ${match.team2.map(p => `<span>${p.firstName.charAt(0)}. ${p.lastName}</span>`).join('')}
                    </div>
                    <div class="score-mini">${score2}</div>
                </div>
            </div>
        `;
    }

    generateRankingsHTML() {
        this.calculateRankings();

        const sortedPlayers = [...this.players].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.goalAverage !== a.goalAverage) return b.goalAverage - a.goalAverage;
            return a.fullName.localeCompare(b.fullName);
        });

        // Determine ranks with ties
        let currentRank = 1;
        const playersWithRanks = sortedPlayers.map((player, index) => {
            if (index > 0) {
                const prev = sortedPlayers[index - 1];
                if (player.wins !== prev.wins || player.goalAverage !== prev.goalAverage) {
                    currentRank = index + 1;
                }
            }
            return { ...player, rank: currentRank };
        });

        return `
            <div class="card">
                <h2>🏆 Classement Final</h2>
                <table class="rankings-table">
                    <thead>
                        <tr>
                            <th>Rang</th>
                            <th>Joueur</th>
                            <th>Victoires</th>
                            <th>Points Pour</th>
                            <th>Points Contre</th>
                            <th>Goal Average</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playersWithRanks.map((player, index) => {
            let badgeClass = 'default';
            if (player.rank === 1) badgeClass = 'gold';
            else if (player.rank === 2) badgeClass = 'silver';
            else if (player.rank === 3) badgeClass = 'bronze';

            // Check if tied with next player
            const isTied = index < playersWithRanks.length - 1 &&
                playersWithRanks[index + 1].rank === player.rank;

            return `
                                <tr>
                                    <td>
                                        <span class="rank-badge ${badgeClass}">
                                            ${player.rank}${isTied ? '=' : ''}
                                        </span>
                                    </td>
                                    <td><strong>${player.fullName}</strong></td>
                                    <td><span class="stat-value">${player.wins}</span></td>
                                    <td><span class="stat-value">${player.pointsFor}</span></td>
                                    <td><span class="stat-value">${player.pointsAgainst}</span></td>
                                    <td>
                                        <span class="stat-value ${player.goalAverage > 0 ? 'stat-positive' : player.goalAverage < 0 ? 'stat-negative' : ''}">
                                            ${player.goalAverage > 0 ? '+' : ''}${player.goalAverage}
                                        </span>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    printRound(roundIndex) {
        const round = this.rounds[roundIndex];

        const matchRows = round.matches.map(match => {
            const team1Names = match.team1.map(p => p.fullName).join(' / ');
            const team2Names = match.team2.map(p => p.fullName).join(' / ');
            return `
                <tr>
                    <td class="col-terrain">T${match.terrainNumber}</td>
                    <td class="col-team">${team1Names}</td>
                    <td class="col-vs">vs</td>
                    <td class="col-team">${team2Names}</td>
                </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Partie ${round.roundNumber} — Concours de Pétanque</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; background: #fff; padding: 1.2cm 1.5cm; }
  h1 { font-size: 15pt; margin-bottom: 0.15cm; }
  h2 { font-size: 12pt; color: #555; font-weight: normal; margin-bottom: 0.7cm; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #e8e8e8; padding: 5px 8px; text-align: left; border: 1px solid #999; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 6px 8px; border: 1px solid #ccc; vertical-align: middle; }
  tr:nth-child(even) td { background: #f6f6f6; }
  .col-terrain { text-align: center; font-weight: bold; width: 3.5em; color: #333; }
  .col-vs { text-align: center; width: 3em; color: #888; font-style: italic; }
  .col-team { width: 46%; }
</style>
</head>
<body>
<h1>🎯 Concours de Pétanque</h1>
<h2>Partie ${round.roundNumber}</h2>
<table>
  <thead>
    <tr>
      <th>Terrain</th>
      <th>Équipe 1</th>
      <th></th>
      <th>Équipe 2</th>
    </tr>
  </thead>
  <tbody>${matchRows}</tbody>
</table>
</body>
</html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
    }

    toggleView(mode, roundIndex) {
        this.viewMode = mode;
        this.saveToLocalStorage();

        // Update the specific round display
        const roundContent = document.getElementById(`round-${roundIndex}`);
        if (roundContent) {
            const round = this.rounds[roundIndex];
            roundContent.innerHTML = this.generateRoundHTML(round, roundIndex);
        }
    }

    showTab(index) {
        const tabs = document.querySelectorAll('.tab');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach((tab, i) => {
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        contents.forEach((content, i) => {
            if (i === index) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Refresh rankings if showing rankings tab
        if (index === this.rounds.length) {
            this.refreshRankings();
        }
    }

    // ===================================
    // Match Management
    // ===================================

    selectWinner(roundIndex, matchIndex, team) {
        const match = this.rounds[roundIndex].matches[matchIndex];
        match.winner = team;

        this.saveToLocalStorage();
        this.refreshMatch(roundIndex, matchIndex);
    }

    updateScore(roundIndex, matchIndex, team, score) {
        const match = this.rounds[roundIndex].matches[matchIndex];
        const scoreValue = score === '' ? null : parseInt(score);

        if (team === 1) {
            match.scoreTeam1 = scoreValue;
        } else {
            match.scoreTeam2 = scoreValue;
        }

        // Si le score saisi est 13, désigner automatiquement cette équipe comme gagnante
        if (scoreValue === 13) {
            match.winner = team;
        } else if (match.winner === team && scoreValue !== null && scoreValue < 13) {
            // Si c'était l'équipe gagnante mais que le score n'est plus 13, on retire le statut de gagnant
            match.winner = null;
        }

        this.saveToLocalStorage();
        this.refreshMatch(roundIndex, matchIndex);
    }

    refreshMatch(roundIndex, matchIndex) {
        const match = this.rounds[roundIndex].matches[matchIndex];
        const matchElement = document.getElementById(`match-${roundIndex}-${matchIndex}`);

        if (!matchElement) return;

        // Si on est en vue condensée, on remplace tout (pas d'input focus à préserver)
        if (this.viewMode === 'condensed') {
            matchElement.outerHTML = this.generateMatchHTML(match, roundIndex, matchIndex);
            return;
        }

        // Vue détaillée : mise à jour sélective pour préserver le focus et la navigation au clavier (TAB)
        const isCompleted = match.winner !== null;
        matchElement.classList.toggle('completed', isCompleted);

        const teams = matchElement.querySelectorAll('.team');
        if (teams.length >= 2) {
            teams[0].classList.toggle('winner', match.winner === 1);
            teams[1].classList.toggle('winner', match.winner === 2);
        }

        const inputs = matchElement.querySelectorAll('input[type="number"]');
        if (inputs.length >= 2) {
            const val1 = match.scoreTeam1 ?? '';
            const val2 = match.scoreTeam2 ?? '';
            // Mise à jour uniquement si nécessaire pour éviter des effets de bord sur l'input actif
            if (inputs[0].value !== val1.toString()) inputs[0].value = val1;
            if (inputs[1].value !== val2.toString()) inputs[1].value = val2;
        }
    }

    // ===================================
    // Rankings Calculation
    // ===================================

    calculateRankings() {
        // Reset all player stats
        this.players.forEach(player => {
            player.wins = 0;
            player.pointsFor = 0;
            player.pointsAgainst = 0;
            player.goalAverage = 0;
        });

        // Calculate stats from all matches
        this.rounds.forEach(round => {
            round.matches.forEach(match => {
                if (match.winner && match.scoreTeam1 !== null && match.scoreTeam2 !== null) {
                    const team1Players = match.team1;
                    const team2Players = match.team2;

                    // Update points
                    team1Players.forEach(p => {
                        const player = this.players.find(pl => pl.id === p.id);
                        player.pointsFor += match.scoreTeam1;
                        player.pointsAgainst += match.scoreTeam2;
                    });

                    team2Players.forEach(p => {
                        const player = this.players.find(pl => pl.id === p.id);
                        player.pointsFor += match.scoreTeam2;
                        player.pointsAgainst += match.scoreTeam1;
                    });

                    // Update wins
                    if (match.winner === 1) {
                        team1Players.forEach(p => {
                            const player = this.players.find(pl => pl.id === p.id);
                            player.wins++;
                        });
                    } else if (match.winner === 2) {
                        team2Players.forEach(p => {
                            const player = this.players.find(pl => pl.id === p.id);
                            player.wins++;
                        });
                    }
                }
            });
        });

        // Calculate goal average
        this.players.forEach(player => {
            player.goalAverage = player.pointsFor - player.pointsAgainst;
        });
    }

    refreshRankings() {
        const rankingsContent = document.getElementById('rankings');
        if (rankingsContent) {
            rankingsContent.innerHTML = this.generateRankingsHTML();
        }
    }

    // ===================================
    // Local Storage
    // ===================================

    newTournament() {
        if (confirm('Êtes-vous sûr de vouloir créer un nouveau concours ? Les données actuelles seront perdues.')) {
            localStorage.removeItem('petanqueTournament');
            location.reload();
        }
    }

    saveToLocalStorage() {
        const data = {
            players: this.players,
            tournamentType: this.tournamentType,
            numRounds: this.numRounds,
            firstTerrain: this.firstTerrain,
            skipTerrain: this.skipTerrain,
            rounds: this.rounds,
            viewMode: this.viewMode
        };
        localStorage.setItem('petanqueTournament', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('petanqueTournament');
        if (saved) {
            const data = JSON.parse(saved);
            this.players = data.players || [];
            this.tournamentType = data.tournamentType || 'doublette';
            this.numRounds = data.numRounds || 5;
            this.firstTerrain = data.firstTerrain || 1;
            this.skipTerrain = data.skipTerrain || false;
            this.rounds = data.rounds || [];
            this.viewMode = data.viewMode || 'detailed';

            if (this.rounds.length > 0) {
                // Show new tournament button
                document.getElementById('new-tournament-btn').style.display = 'block';
                // Restore tournament state
                document.getElementById('tournament-type').value = this.tournamentType;
                document.getElementById('num-rounds').value = this.numRounds;
                document.getElementById('first-terrain').value = this.firstTerrain;
                document.getElementById('skip-terrain').checked = this.skipTerrain;
                this.displayTournament();
            } else if (this.players.length > 0) {
                // Just show player preview
                this.displayPlayerPreview();
                this.updateStartButtonState();
            }
        }
    }
}

// Initialize the application
const tournamentManager = new TournamentManager();
