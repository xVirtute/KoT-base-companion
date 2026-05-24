// KOT
// ==========================================
// 1. MASTER DATA LAYER (Model)
// ==========================================
let gameState = {
    players: [],
    harborAvailable: false,
    activePlayerId: 0,         // Tracks whose turn it is (0 = Player 1, 1 = Player 2, etc.)
    currentTurnResolved: true,   // Hides the staging drawer until a roll is sent over
    rolledTotals: { one: 0, two: 0, three: 0, energy: 0, heart: 0, claw: 0 },
    turnStaging: { vp: 0, hp: 0, energy: 0, damage: 0 } // Our temporary tweakable staging area
};

let turnRollCount = 0;
let poolSize = 6;
let diceArray = [];
let executionLock = false;

const FACES = ['one', 'two', 'three', 'energy', 'heart', 'claw'];

const SVG_ASSETS = {
  one: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-zinc-400 fill-current"><text x="50%" y="75%" text-anchor="middle" font-family="'Luckiest Guy', cursive" font-size="75" stroke="#000" stroke-width="4">1</text></svg>`,
  two: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-zinc-400 fill-current"><text x="50%" y="75%" text-anchor="middle" font-family="'Luckiest Guy', cursive" font-size="75" stroke="#000" stroke-width="4">2</text></svg>`,
  three: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-zinc-400 fill-current"><text x="50%" y="75%" text-anchor="middle" font-family="'Luckiest Guy', cursive" font-size="75" stroke="#000" stroke-width="4">3</text></svg>`,
  energy: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-yellow-400 fill-current"><polygon points="62,8 24,54 52,54 38,92 76,46 48,46" stroke="#000" stroke-width="3"/></svg>`,
  heart: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-emerald-500 fill-current"><path d="M50,84 C50,84 14,60 14,36 C14,18 32,10 50,28 C68,10 86,18 86,36 C86,60 50,84 50,84 Z" stroke="#000" stroke-width="4"/></svg>`,
  claw: `<svg viewBox="0 0 100 100" class="w-5/6 h-5/6 text-red-500 fill-current"><path d="M20,75 C30,50 35,25 25,10 C40,25 45,45 42,65 C52,40 62,20 55,5 C68,20 72,40 65,60 C75,40 88,25 85,10 C92,28 90,48 78,68 C65,85 45,95 20,75 Z" stroke="#000" stroke-width="3"/></svg>`
};

const MONSTERS = ["Gigazaur", "Kraken", "The King", "Cyber Bunny", "Alienoid", "Meka Dragon"];
const THEME_COLORS = [
  { name: "Red", class: "text-red-500" },
  { name: "Yellow", class: "text-yellow-400" },
  { name: "Emerald", class: "text-emerald-400" },
  { name: "Blue", class: "text-blue-400" },
  { name: "Purple", class: "text-purple-400" },
  { name: "Orange", class: "text-orange-500" }
];

// ==========================================
// 2. SETUP SCREEN CONTROLLER LOGIC
// ==========================================
function setSetupPlayerCount(count) {
  document.querySelectorAll('.setup-count-btn').forEach(btn => {
    btn.className = "setup-count-btn bg-zinc-800 border-2 border-zinc-700 py-2 rounded-xl font-comic-heavy text-lg text-zinc-400 transition-all";
  });
  const activeBtn = document.getElementById(`btn-count-${count}`);
  if (activeBtn) activeBtn.className = "setup-count-btn bg-yellow-400 border-2 border-black py-2 rounded-xl font-comic-heavy text-lg text-neutral-950 scale-105 shadow-md transition-all";

  const rosterContainer = document.getElementById('setup-players-roster');
  if (!rosterContainer) return;

  rosterContainer.innerHTML = Array.from({ length: count }).map((_, i) => `
    <div class="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <span class="font-comic-heavy text-zinc-500 text-sm">#${i + 1}</span>
        <input type="text" id="setup-name-${i}" placeholder="Player Name" value="Player ${i + 1}" class="flex-1 bg-black border border-zinc-800 px-3 py-1.5 rounded-xl font-sans text-sm focus:outline-none focus:border-yellow-400 text-zinc-200">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <select id="setup-monster-${i}" class="bg-zinc-950 border border-zinc-800 px-2 py-1.5 rounded-xl text-xs font-bold text-zinc-300 focus:outline-none">
          ${MONSTERS.map((m, idx) => `<option value="${m}" ${idx === i ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <select id="setup-color-${i}" class="bg-zinc-950 border border-zinc-800 px-2 py-1.5 rounded-xl text-xs font-bold text-zinc-300 focus:outline-none">
          ${THEME_COLORS.map((c, idx) => `<option value="${c.class}" ${idx === i ? 'selected' : ''}>${c.name} Style</option>`).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

function initGameFromSetup() {
  const inputs = document.querySelectorAll('[id^="setup-name-"]');
  gameState.players = [];
  
  inputs.forEach((_, i) => {
    const nameVal = document.getElementById(`setup-name-${i}`).value.trim();
    const monsterVal = document.getElementById(`setup-monster-${i}`).value;
    const colorVal = document.getElementById(`setup-color-${i}`).value;

    gameState.players.push({
      id: i,
      name: nameVal || monsterVal.toUpperCase(),
      monster: monsterVal,
      color: colorVal,
      hp: 10,
      vp: 0,
      energy: 0,
location: 'outside'
    });
  });
  gameState.harborAvailable = gameState.players.length >= 5;

  document.getElementById('tab-setup-view').classList.add('hidden');
  document.getElementById('main-nav').classList.remove('hidden');
  
  buildFreshPool();
  renderScoreboard();
  showTab('score');
}

// ==========================================
// 3. SCORE & STATE CONTROLLER LOGIC
// ==========================================
function changeActivePlayer(playerId) {
  gameState.activePlayerId = playerId;
  // Clear out any unsaved staging data from the previous person so numbers don't leak
  gameState.currentTurnResolved = true; 
  renderScoreboard();
}

function sendRollToScoreboard() {
  const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId);
  if (!activePlayer) return;

  const t = gameState.rolledTotals;
  
  // 1. Calculate Standard Points (3-of-a-kind rule)
  let calculatedVp = 0;
  if (t.one >= 3) calculatedVp += 1 + (t.one - 3);
  if (t.two >= 3) calculatedVp += 2 + (t.two - 3);
  if (t.three >= 3) calculatedVp += 3 + (t.three - 3);

  // 2. Calculate Energy
  let calculatedEnergy = t.energy;
  
  // 3. Calculate Hearts (Heal only works if you are OUTSIDE Tokyo)
  let calculatedHp = (activePlayer.location === 'outside') ? t.heart : 0;
  
  // 4. Calculate Attack Smashes
  let calculatedDamage = t.claw;

  // Save everything to our tweakable staging deck
  gameState.turnStaging = {
    vp: calculatedVp,
    hp: calculatedHp,
    energy: calculatedEnergy,
    damage: calculatedDamage
  };

  gameState.currentTurnResolved = false;
  
  // Go back to scoreboard view and refresh layout
  showTab('score');
  renderScoreboard();
}
function tweakStaging(stat, amount) {
  gameState.turnStaging[stat] = Math.max(0, gameState.turnStaging[stat] + amount);
  renderScoreboard();
}

function commitAndEndTurn() {
  const player = gameState.players.find(p => p.id === gameState.activePlayerId);
  if (player) {
    // Commit the staged rewards safely to the permanent stats
    player.vp = Math.min(20, player.vp + gameState.turnStaging.vp);
    player.hp = Math.min(10, player.hp + gameState.turnStaging.hp);
    player.energy = player.energy + gameState.turnStaging.energy;
  }

  // 1. Reset turn states for the next round
  gameState.currentTurnResolved = true;
  turnRollCount = 0;
  
  const counterDisplay = document.getElementById('roll-counter-display');
  if (counterDisplay) counterDisplay.innerText = 0;

  // 2. Clear out dice shelf completely
  buildFreshPool();

  // 3. Pass the spotlight clockwise to the next living player
  gameState.activePlayerId = (gameState.activePlayerId + 1) % gameState.players.length;

  renderScoreboard();
}

function changeScoreStat(playerId, stat, amount) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
        player[stat] = Math.max(0, player[stat] + amount);
        renderScoreboard();
    }
}
function toggleLocation(playerId, targetLocation) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  // If already there, clicking leaves Tokyo back to the outside world
  if (player.location === targetLocation) {
    player.location = 'outside';
  } else {
    // Eviction Rule: Anyone currently in our target slot gets booted outside
    gameState.players.forEach(p => {
      if (p.location === targetLocation) p.location = 'outside';
    });
    player.location = targetLocation;
  }
  renderScoreboard();
}


// ==========================================
// 4. DICE ENGINE LOGIC
// ==========================================
function buildFreshPool() {
  diceArray = [];
  for (let i = 0; i < poolSize; i++) {
    diceArray.push({ id: i, face: null, held: false, isShuffling: false });
  }
  renderTable();
}

function adjustPoolSize(delta) {
  if (executionLock) return;
  const computed = poolSize + delta;
  if (computed >= 1 && computed <= 8) {
    poolSize = computed;
    const display = document.getElementById('pool-display');
    if (display) display.innerText = poolSize;
    buildFreshPool();
  }
}

function toggleLockState(id) {
  if (executionLock) return;
  const target = diceArray.find(d => d.id === id);
  if (target.face === null) return;
  target.held = !target.held;
  renderTable();
}

function executeManualRoll() {
  if (executionLock) return;
  const rollTargets = diceArray.filter(d => !d.held);
  if (rollTargets.length === 0) return;
  
  turnRollCount++;
  const counterDisplay = document.getElementById('roll-counter-display');
  if (counterDisplay) counterDisplay.innerText = turnRollCount;
  
  executionLock = true;
  let tickCount = 0;
  const absoluteTicks = 8;
  const speedStep = 38;
  
  const shuffleTimer = setInterval(() => {
    rollTargets.forEach(die => {
      die.isShuffling = true;
      die.face = FACES[Math.floor(Math.random() * FACES.length)];
    });
    renderTable();
    tickCount++;
    
    if (tickCount >= absoluteTicks) {
      clearInterval(shuffleTimer);
      
      // 1. Lock in the final absolute faces for the rolling dice
      rollTargets.forEach(die => {
        die.isShuffling = false;
        die.face = FACES[Math.floor(Math.random() * FACES.length)];
      });
      
      // 2. Reset our tally counter for this fresh calculation
      gameState.rolledTotals = { one: 0, two: 0, three: 0, energy: 0, heart: 0, claw: 0 };
      
      // 3. Tally every single die in our pool (both held and just rolled)
      diceArray.forEach(die => {
        if (die.face) {
          gameState.rolledTotals[die.face]++;
        }
      });
      
      // 4. Set our tracker flag to show a roll is hot and unsubmitted
      gameState.currentTurnResolved = false;
      
      executionLock = false;
      renderTable();
      
      // Optional debug line to verify it works on your phone:
      console.log("Current Tally:", JSON.stringify(gameState.rolledTotals));
    }
  }, speedStep);
}

// ==========================================
// 5. UI RENDERING LAYER (View)
// ==========================================
function showTab(targetTab) {
  document.getElementById('tab-score-view').classList.toggle('hidden', targetTab !== 'score');
  document.getElementById('tab-dice-view').classList.toggle('hidden', targetTab !== 'dice');
  
  const scoreBtn = document.getElementById('nav-score');
  const diceBtn = document.getElementById('nav-dice');
  
  if (targetTab === 'score') {
    scoreBtn.className = "flex-1 py-2 bg-zinc-100 text-neutral-950 font-comic-heavy rounded-xl text-xs uppercase tracking-wider transition-all";
    diceBtn.className = "flex-1 py-2 bg-transparent font-comic-heavy rounded-xl text-xs uppercase text-zinc-400 hover:text-white tracking-wider transition-all";
  } else {
    scoreBtn.className = "flex-1 py-2 bg-transparent font-comic-heavy rounded-xl text-xs uppercase text-zinc-400 hover:text-white tracking-wider transition-all";
    diceBtn.className = "flex-1 py-2 bg-zinc-100 text-neutral-950 font-comic-heavy rounded-xl text-xs uppercase tracking-wider transition-all";
    renderTable();
  }
}

function renderScoreboard() {
    const container = document.getElementById('player-grid');
    if (!container) return;
    
    container.innerHTML = gameState.players.map(p => {
        const inCity = p.location === 'tokyo';
        const inHarbor = p.location === 'harbor';
        
        // Check if this card belongs to the active player
        const isActivePlayer = p.id === gameState.activePlayerId;
        
        // Show the staging drawer ONLY for the active player if they have an active uncommitted roll
        const showStagingDrawer = isActivePlayer && !gameState.currentTurnResolved;

        return `
        <div class="bg-neutral-900 border-2 ${inCity ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : inHarbor ? 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.4)]' : isActivePlayer ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'border-black'} p-4 rounded-xl flex flex-col gap-3 shadow-[4px_4px_0px_#000000] transition-all duration-200">
            
            <div class="flex justify-between items-center w-full">
                <div class="flex flex-col gap-2 cursor-pointer" onclick="changeActivePlayer(${p.id})">
                  <div class="flex items-center gap-2">
                    ${isActivePlayer ? '<span class="text-yellow-400 text-sm animate-pulse">▶</span>' : ''}
                    <span class="font-bold uppercase text-lg ${p.color}">${p.name}</span>
                  </div>
                  <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block -mt-2">${p.monster}</span>
                  
                  <div class="flex gap-1.5 mt-1">
                    <button onclick="toggleLocation(${p.id}, 'tokyo')" class="px-2 py-1 rounded text-[11px] font-comic-heavy tracking-wide transition-all border ${inCity ? 'bg-purple-600 border-purple-400 text-white animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}">
                      👑 CITY
                    </button>
                    ${gameState.harborAvailable ? `
                      <button onclick="toggleLocation(${p.id}, 'harbor')" class="px-2 py-1 rounded text-[11px] font-comic-heavy tracking-wide transition-all border ${inHarbor ? 'bg-sky-600 border-sky-400 text-white animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}">
                        ⚓ HARBOR
                      </button>
                    ` : ''}
                  </div>
                </div>
                
                <div class="flex gap-4 text-center">
                    ${renderStat(p.id, 'hp', p.hp, 'text-red-500')}
                    ${renderStat(p.id, 'vp', p.vp, 'text-yellow-400')}
                    ${renderStat(p.id, 'energy', p.energy, 'text-emerald-400')}
                </div>
            </div>

            ${showStagingDrawer ? `
                <div class="mt-2 border-t border-zinc-800 pt-3 flex flex-col gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <div class="text-[11px] font-comic-heavy text-yellow-400 uppercase tracking-wider flex justify-between">
                        <span>🎲 Staging Area</span>
                        <span class="text-zinc-500">Tweak for Card Effects</span>
                    </div>
                    
                    <div class="grid grid-cols-4 gap-1 text-center bg-zinc-900/50 p-2 rounded-lg border border-zinc-900">
                        <div class="flex flex-col items-center">
                            <span class="text-[9px] font-bold text-yellow-400 uppercase">⭐ VP</span>
                            <span class="text-xl font-black text-white py-0.5">${gameState.turnStaging.vp}</span>
                            <div class="flex gap-1.5">
                                <button onclick="tweakStaging('vp', -1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('vp', 1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[9px] font-bold text-red-500 uppercase">💚 HP</span>
                            <span class="text-xl font-black text-white py-0.5">${gameState.turnStaging.hp}</span>
                            <div class="flex gap-1.5">
                                <button onclick="tweakStaging('hp', -1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('hp', 1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[9px] font-bold text-emerald-400 uppercase">⚡ ENG</span>
                            <span class="text-xl font-black text-white py-0.5">${gameState.turnStaging.energy}</span>
                            <div class="flex gap-1.5">
                                <button onclick="tweakStaging('energy', -1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('energy', 1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[9px] font-bold text-orange-500 uppercase">💥 DMG</span>
                            <span class="text-xl font-black text-white py-0.5">${gameState.turnStaging.damage}</span>
                            <div class="flex gap-1.5">
                                <button onclick="tweakStaging('damage', -1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('damage', 1)" class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="commitAndEndTurn()" class="w-full bg-emerald-500 border-2 border-black py-2 rounded-xl font-comic-heavy text-xs uppercase tracking-wide text-neutral-950 shadow-[2px_2px_0px_#000000] active:scale-98 transition-all">
                        💥 Apply & End Turn
                    </button>
                </div>
            ` : ''}
        </div>
        `;
    }).join('');
}


function renderStat(id, stat, value, colorClass) {
    return `
        <div class="flex flex-col items-center w-14">
            <span class="text-[9px] uppercase tracking-wider ${colorClass}/70 font-bold">${stat}</span>
            <span class="text-2xl font-black ${colorClass}">${value}</span>
            <div class="flex gap-2 mt-1">
                <button onclick="changeScoreStat(${id}, '${stat}', -1)" class="bg-neutral-800 border border-black px-2 py-0.5 rounded text-xs select-none">-</button>
                <button onclick="changeScoreStat(${id}, '${stat}', 1)" class="bg-neutral-800 border border-black px-2 py-0.5 rounded text-xs select-none">+</button>
            </div>
        </div>
    `;
}

function renderTable() {
  const activeShelf = document.getElementById('active-shelf');
  const lockedShelf = document.getElementById('locked-shelf');
  if (!activeShelf || !lockedShelf) return;
  
  activeShelf.innerHTML = '';
  lockedShelf.innerHTML = '';
  
  diceArray.filter(d => !d.held).forEach(die => activeShelf.appendChild(generateDieMarkup(die)));
  diceArray.filter(d => d.held).forEach(die => lockedShelf.appendChild(generateDieMarkup(die)));
}

function generateDieMarkup(die) {
  const block = document.createElement('button');
  let componentClasses = "aspect-square w-full max-w-[85px] rounded-2xl bg-zinc-800 border-4 border-zinc-700 flex items-center justify-center p-2 shadow-[4px_4px_0px_#000000] active:scale-95 transition-all duration-75 ";
  if (die.held) componentClasses += "held-style";
  block.className = componentClasses;
  if (die.isShuffling) block.classList.add('animate-tumble');
  block.onclick = () => toggleLockState(die.id);
  
  if (die.face) block.innerHTML = SVG_ASSETS[die.face];
  else block.innerHTML = `<span class="font-comic-heavy text-3xl text-zinc-600 select-none">?</span>`;
  return block;
}

function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}
