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

const MONSTERS = [
  "Gigazaur", "Kraken", "The King", "Cyber Bunny", "Alienoid", "Meka Dragon",
  "Space Penguin", "Cybertooth", "Pandakai", "Pumpkin Jack", "Cthulhu", "King Kong", "Anubis", "Boogie Woogie"
];

const THEME_COLORS = [
  { name: "Red", class: "text-red-500" },
  { name: "Yellow", class: "text-yellow-400" },
  { name: "Emerald", class: "text-emerald-400" },
  { name: "Blue", class: "text-blue-400" },
  { name: "Purple", class: "text-purple-400" },
  { name: "Orange", class: "text-orange-500" },
  { name: "Cyan", class: "text-cyan-400" },
  { name: "Pink", class: "text-pink-500" },
  { name: "Indigo", class: "text-indigo-400" },
  { name: "Lime", class: "text-lime-400" },
  { name: "Rose", class: "text-rose-500" },
  { name: "Violet", class: "text-violet-400" }
];


// ==========================================
// 2. SETUP SCREEN CONTROLLER LOGIC
// ==========================================
let chosenPlayerCount = 4; // Fallback default tracker

function setSetupPlayerCount(count) {
  chosenPlayerCount = count;
  
  document.querySelectorAll('.setup-count-btn').forEach(btn => {
    btn.className = "setup-count-btn bg-zinc-800 border-2 border-zinc-700 py-2 rounded-xl font-comic-heavy text-lg text-zinc-400 transition-all";
  });
  const activeBtn = document.getElementById(`btn-count-${count}`);
  if (activeBtn) activeBtn.className = "setup-count-btn bg-yellow-400 border-2 border-black py-2 rounded-xl font-comic-heavy text-lg text-neutral-950 scale-105 shadow-md transition-all";

  // Automated Rule: Tokyo Harbor auto-toggles for 5-6 player environments
  const harborToggle = document.getElementById('setup-toggle-harbor');
  if (harborToggle) {
    harborToggle.checked = (count >= 5);
  }

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

function commitSetupAndStart() {
  const playersArray = [];
  const rosterContainer = document.getElementById('setup-players-roster');
  if (!rosterContainer) return;

  // 🔍 DYNAMIC SCAN: Count exactly how many name fields are physically on the screen
  const totalRenderedInputs = rosterContainer.querySelectorAll('input[id^="setup-name-"]').length;
  
  if (totalRenderedInputs === 0) {
    alert("⚠️ The roster looks empty. Please click a player count button first!");
    return;
  }

  for (let i = 0; i < totalRenderedInputs; i++) {
    const nameInput = document.getElementById(`setup-name-${i}`);
    const monsterSelect = document.getElementById(`setup-monster-${i}`);
    const colorSelect = document.getElementById(`setup-color-${i}`);
    
    // Defensive check: skip if any row element got clipped out
    if (!nameInput || !monsterSelect || !colorSelect) continue;

    playersArray.push({
      id: i,
      name: nameInput.value.trim() || `Player ${i + 1}`,
      monster: monsterSelect.value,
      color: colorSelect.value,
      hp: 10,
      vp: 0,
      energy: 0,
      location: 'outside',
      showStatusDrawer: false, 
      statuses: { zombie: false, armor: false },
      tokens: { poison: 0, shrink: 0, smoke: 0, mimic: false }
    });
  }

  // Safe configurations check
  const harborToggle = document.getElementById('setup-toggle-harbor');
  gameState.harborAvailable = harborToggle ? harborToggle.checked : false;

  gameState.players = playersArray;
  gameState.activePlayerId = 0;
  gameState.currentTurnResolved = true;

  // Swap layout view layers safely
  document.getElementById('tab-setup-view').classList.add('hidden');
  
  const mainNav = document.getElementById('main-nav');
  if (mainNav) mainNav.classList.remove('hidden');

  showTab('score');
  renderScoreboard();
}


// ==========================================
// 3. SCORE & STATE CONTROLLER LOGIC
// ==========================================
// NEW HELPER: Handles moves and automatically awards +1 VP for entering Tokyo
function setPlayerLocation(player, newLocation) {
  const oldLocation = player.location;
  player.location = newLocation;

  // Rule: Entering Tokyo/Harbor from the outside rewards 1 VP instantly
  if (oldLocation === 'outside' && (newLocation === 'tokyo' || newLocation === 'harbor')) {
    player.vp = Math.min(20, player.vp + 1);
  }
}

// UPDATED: Now uses our helper to safely handle manual scoreboard overrides
function toggleLocation(playerId, targetLocation) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  if (player.location === targetLocation) {
    setPlayerLocation(player, 'outside');
  } else {
    // Eviction Rule: Kick out anyone currently in that specific slot
    gameState.players.forEach(p => {
      if (p.location === targetLocation) setPlayerLocation(p, 'outside');
    });
    setPlayerLocation(player, targetLocation);
  }
  renderScoreboard();
}

// UPDATED: Now automatically awards +2 VP if the newly selected player starts in Tokyo
function changeActivePlayer(playerId) {
  gameState.activePlayerId = playerId;
  gameState.currentTurnResolved = true; 

  const player = gameState.players.find(p => p.id === playerId);
  if (player && player.hp > 0 && (player.location === 'tokyo' || player.location === 'harbor')) {
    player.vp = Math.min(20, player.vp + 2);
    alert(`👑 ${player.name} starts their turn in Tokyo! +2 VP awarded.`);
  }

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

function changeScoreStat(playerId, stat, amount) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    if (!player.statuses) player.statuses = { zombie: false, armor: false };

    // 🧟 ZOMBIE RULE: Completely block healing modifications
    if (player.statuses.zombie && stat === 'hp' && amount > 0) {
        alert(`🧟 Undead monsters cannot heal!`);
        return;
    }

    // Standard elimination checkpoint
    const isCurrentlyDead = player.hp <= 0 && !player.statuses.zombie;
    if (isCurrentlyDead && stat !== 'hp') return; 

    player[stat] = Math.max(0, player[stat] + amount);

    // Elimination Trigger: Ignore if they are currently a zombie
    if (stat === 'hp' && player.hp === 0 && !player.statuses.zombie) {
        player.location = 'outside';
        alert(`💀 ${player.name} has been eliminated from the game!`);
    }

    renderScoreboard();
    checkVictoryConditions();
}

function commitAndEndTurn() {
  const attacker = gameState.players.find(p => p.id === gameState.activePlayerId);
  if (!attacker) return;

  attacker.vp = Math.min(20, attacker.vp + gameState.turnStaging.vp);
  attacker.hp = Math.min(10, attacker.hp + gameState.turnStaging.hp);
  attacker.energy = attacker.energy + gameState.turnStaging.energy;

  const attackDmg = gameState.turnStaging.damage;
  const attackerInTokyo = (attacker.location === 'tokyo' || attacker.location === 'harbor');
  let someoneYielded = false;
  let vacatedSlot = '';

  if (attackDmg > 0) {
    gameState.players.forEach(target => {
      if (target.id === attacker.id) return;
      
      // Check if target is truly dead (HP 0 and not a zombie)
      const targetDead = target.hp <= 0 && (!target.statuses || !target.statuses.zombie);
      if (targetDead) return;

      const targetInTokyo = (target.location === 'tokyo' || target.location === 'harbor');

      if ((attackerInTokyo && !targetInTokyo) || (!attackerInTokyo && targetInTokyo)) {
        
        // 🛡️ ARMOR RULE: Mitigate incoming smash values by 1
        let finalDamage = attackDmg;
        if (target.statuses && target.statuses.armor) {
          finalDamage = Math.max(0, finalDamage - 1);
        }

        target.hp = Math.max(0, target.hp - finalDamage);

        // Handle survival interactions and yield requests
        if (!attackerInTokyo && targetInTokyo && target.hp > 0) {
          const wantsToYield = confirm(`💥 ${target.name} took ${finalDamage} damage in Tokyo!\n\nDo they want to YIELD Tokyo and step outside?`);
          if (wantsToYield) {
            vacatedSlot = target.location;
            setPlayerLocation(target, 'outside');
            someoneYielded = true;
          }
        }
        
        // Automatic Eviction rule if a non-zombie hits absolute zero
        if (target.hp === 0 && (!target.statuses || !target.statuses.zombie) && targetInTokyo) {
          vacatedSlot = target.location;
          setPlayerLocation(target, 'outside');
          someoneYielded = true;
        }
      }
    });

    if (someoneYielded && attacker.location === 'outside') {
      setPlayerLocation(attacker, vacatedSlot);
    }
  }

  const isTokyoOccupied = gameState.players.some(p => {
    const isAlive = p.hp > 0 || (p.statuses && p.statuses.zombie);
    return isAlive && p.location === 'tokyo';
  });
  
  if (!isTokyoOccupied && attacker.hp > 0 && attacker.location === 'outside') {
    setPlayerLocation(attacker, 'tokyo');
    alert(`Rex Tokyo was empty! ${attacker.name} marches in. +1 VP awarded.`);
  }
  // ==========================================
  // EXPANSION AUTOMATION: Resolve End-of-Turn Poison
  // ==========================================
  if (attacker.tokens && attacker.tokens.poison > 0) {
    attacker.hp = Math.max(0, attacker.hp - attacker.tokens.poison);
    alert(`🤢 ${attacker.name} suffers ${attacker.tokens.poison} damage from Poison tokens at the end of their turn!`);
    
    // If poison kills them, boot them out of Tokyo immediately
    if (attacker.hp === 0) {
      attacker.location = 'outside';
    }
  }
  // clean up the current turn state 
  gameState.currentTurnResolved = true;
  turnRollCount = 0;
  
  const counterDisplay = document.getElementById('roll-counter-display');
  if (counterDisplay) counterDisplay.innerText = 0;

  buildFreshPool();

  // Route clockwise, skipping only truly eliminated players (0 HP and NOT a zombie)
  let nextId = gameState.activePlayerId;
  do {
    nextId = (nextId + 1) % gameState.players.length;
  } while (gameState.players[nextId].hp <= 0 && (!gameState.players[nextId].statuses || !gameState.players[nextId].statuses.zombie) && nextId !== gameState.activePlayerId);
  
  changeActivePlayer(nextId);
  checkVictoryConditions();
}

// NEW: Checks if a monster has won by points or survival
function checkVictoryConditions() {
  // 1. Condition A: Has anyone reached 20+ Victory Points?
  const vpWinner = gameState.players.find(p => p.vp >= 20);
  if (vpWinner) {
    triggerVictoryScreen(vpWinner, "Victory by Points (20+ VP)!");
    return;
  }

  // 2. Condition B: Is there only one surviving monster left?
  const livingPlayers = gameState.players.filter(p => p.hp > 0);
  if (livingPlayers.length === 1 && gameState.players.length > 1) {
    triggerVictoryScreen(livingPlayers[0], "Last Monster Standing!");
  }
}

// NEW: Generates and handles the full-screen winner card drop
function triggerVictoryScreen(player, reason) {
  let overlay = document.getElementById('victory-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'victory-overlay';
    document.body.appendChild(overlay);
  }
  
  // Set up dynamic layout coloring matching the monster's character theme
  const borderClass = player.color ? player.color.replace('text-', 'border-') : 'border-yellow-400';

  overlay.className = "fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in";
  overlay.innerHTML = `
    <div class="relative bg-zinc-950 border-4 ${borderClass} p-8 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4">
      
      <button onclick="dismissVictoryScreen()" class="absolute top-3 right-4 text-zinc-600 hover:text-zinc-300 font-sans text-xl font-black select-none p-1 active:scale-90 transition-all">✕</button>
      
      <span class="text-6xl animate-bounce mt-2">👑</span>
      <h1 class="font-comic-heavy text-3xl uppercase tracking-wider ${player.color}">${player.name}</h1>
      <p class="text-zinc-500 font-bold text-xs uppercase tracking-wide bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 -mt-2">${player.monster}</p>
      
      <div class="my-3 text-yellow-400 font-comic-heavy text-base uppercase tracking-wide bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-xl w-full">
        ${reason}
      </div>
      
      <button onclick="resetGameToSetup()" class="w-full mt-2 bg-yellow-400 border-2 border-black py-3 rounded-xl font-comic-heavy text-sm uppercase tracking-wider text-neutral-950 shadow-[4px_4px_0px_#000000] active:scale-95 transition-all">
        🔄 Start New Game
      </button>
    </div>
  `;
}

function dismissVictoryScreen() {
  const overlay = document.getElementById('victory-overlay');
  if (overlay) overlay.remove();
}

function resetGameToSetup() {
  dismissVictoryScreen();
  
  // Pivot UI visibility back to the initial layout setup screen
  document.getElementById('tab-setup-view').classList.remove('hidden');
  document.getElementById('main-nav').classList.add('hidden');
  document.getElementById('tab-score-view').classList.add('hidden');
  document.getElementById('tab-dice-view').classList.add('hidden');
  
  // Wipe variables clear for clean roster generation
  gameState.players = [];
  gameState.activePlayerId = 0;
  gameState.currentTurnResolved = true;
}

// NEW: Toggles card statuses safely and handles rule resets
function togglePlayerStatus(playerId, statusName) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  // Initialize status memory safe-net if missing
  if (!player.statuses) {
    player.statuses = { zombie: false, armor: false };
  }

  player.statuses[statusName] = !player.statuses[statusName];

  // Rule Cleanup: If they turn off Zombie mode while at 0 HP, they instantly drop dead
  if (statusName === 'zombie' && !player.statuses.zombie && player.hp === 0) {
    player.location = 'outside';
    alert(`💀 ${player.name} is no longer a Zombie and collapses! Eliminated.`);
  }

  renderScoreboard();
}

// NEW: Manages expansion tokens (Poison, Shrink, Smoke, Mimic)
function changePlayerToken(playerId, tokenType, amount) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  // Safe initialization wrapper
  if (!player.tokens) {
    player.tokens = { poison: 0, shrink: 0, smoke: 0, mimic: false };
  }

  if (tokenType === 'mimic') {
    player.tokens.mimic = !player.tokens.mimic;
  } else {
    player.tokens[tokenType] = Math.max(0, player.tokens[tokenType] + amount);
  }

  renderScoreboard();
}

// NEW: Toggles the visibility of a player's status effect tray
function toggleStatusDrawer(playerId) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;
  
  player.showStatusDrawer = !player.showStatusDrawer;
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

  // EXPANSION AUTOMATION: Shrink tokens subtract from maximum allowed dice
  const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId);
  const shrinkPenalty = (activePlayer && activePlayer.tokens) ? activePlayer.tokens.shrink : 0;
  const maxAllowedDice = Math.max(1, 6 - shrinkPenalty); // Never drop below 1 die

  // If the total dice pool array has expanded beyond our shrunken limit, trim it down
  if (diceArray.length > maxAllowedDice) {
    diceArray = diceArray.slice(0, maxAllowedDice);
  }

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

// Premium Vector Asset Repository for Card Statuses
const STATUS_ICONS = {
  zombie: `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-current text-emerald-400"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
  armor: `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-current text-amber-500"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`,
  mimic: `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-current text-indigo-400"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.2c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.53 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`,
  poison: `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-current text-lime-400"><path d="M12 2c-4.2 0-7 3.22-7 7.5 0 3.12 1.68 5.4 3.44 6.78.43.34.56.94.28 1.41l-1.07 1.79c-.27.45-.11 1.04.34 1.31.45.27 1.04.11 1.31-.34l.87-1.46c.54.14 1.14.22 1.83.22s1.29-.08 1.83-.22l.87 1.46c.27.45.86.61 1.31.34.45-.27.61-.86.34-1.31l-1.07-1.79c-.28-.47-.15-1.07.28-1.41C19.32 14.9 21 12.62 21 9.5 21 5.22 18.2 2 12 2z"/></svg>`,
  shrink: `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-current text-sky-400"><path d="M10.5 4v2.5l2.25-2.25L15 6.5 10.5 11l-4.5-4.5 2.25-2.25L10.5 4zm3 16v-2.5l-2.25 2.25L9 17.5l4.5-4.5 4.5 4.5-2.25 2.25L13.5 20zM4 10.5h2.5l-2.25 2.25L6.5 15l-4.5-4.5 4.5-4.5-2.25 2.25L4 10.5zm16 3h-2.5l2.25-2.25L17.5 9l4.5 4.5-4.5 4.5 2.25-2.25L20 13.5z"/></svg>`,
  smoke: `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-current text-zinc-400"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`
};

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
        const isActivePlayer = p.id === gameState.activePlayerId;
        const showStagingDrawer = isActivePlayer && !gameState.currentTurnResolved;
        
        const isZombie = p.statuses?.zombie || false;
        const hasArmor = p.statuses?.armor || false;
        
        const poisonCount = p.tokens?.poison || 0;
        const shrinkCount = p.tokens?.shrink || 0;
        const smokeCount = p.tokens?.smoke || 0;
        const hasMimic = p.tokens?.mimic || false;
        
        const isEliminated = p.hp <= 0 && !isZombie;
        const isDrawerOpen = p.showStatusDrawer || false;

        // Build a low-profile inline list of active status previews for the main view
        let activePreviewsHtml = '';
        if (!isEliminated) {
          if (isZombie) activePreviewsHtml += `<div class="bg-emerald-950/80 p-1 rounded-md border border-emerald-800">${STATUS_ICONS.zombie}</div>`;
          if (hasArmor) activePreviewsHtml += `<div class="bg-amber-950/80 p-1 rounded-md border border-amber-800">${STATUS_ICONS.armor}</div>`;
          if (hasMimic) activePreviewsHtml += `<div class="bg-indigo-950/80 p-1 rounded-md border border-indigo-800">${STATUS_ICONS.mimic}</div>`;
          if (poisonCount > 0) activePreviewsHtml += `<div class="bg-zinc-950 p-1 rounded-md border border-zinc-800 flex items-center gap-1 text-[10px] text-lime-400 font-black">${STATUS_ICONS.poison}<span>${poisonCount}</span></div>`;
          if (shrinkCount > 0) activePreviewsHtml += `<div class="bg-zinc-950 p-1 rounded-md border border-zinc-800 flex items-center gap-1 text-[10px] text-sky-400 font-black">${STATUS_ICONS.shrink}<span>${shrinkCount}</span></div>`;
          if (smokeCount > 0) activePreviewsHtml += `<div class="bg-zinc-950 p-1 rounded-md border border-zinc-800 flex items-center gap-1 text-[10px] text-zinc-400 font-black">${STATUS_ICONS.smoke}<span>${smokeCount}</span></div>`;
        }

        return `
        <div class="bg-neutral-900 border-2 ${isEliminated ? 'border-zinc-800 opacity-40 grayscale select-none' : inCity ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : inHarbor ? 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.4)]' : isActivePlayer ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'border-black'} p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-[4px_4px_0px_#000000] transition-all duration-200 relative">
            
            <div class="flex justify-between items-start w-full gap-2">
                <div class="flex flex-col cursor-pointer flex-1" onclick="changeActivePlayer(${p.id})">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    ${isActivePlayer && !isEliminated ? '<span class="text-yellow-400 text-xs animate-pulse">▶</span>' : ''}
                    <span class="font-comic-heavy uppercase text-base tracking-wide ${isEliminated ? 'text-zinc-600 line-through' : p.color}">${p.name}</span>
                    ${isEliminated ? '<span class="bg-red-950 border border-red-800 text-[8px] font-black text-red-400 px-1.5 py-0.5 rounded tracking-wide">💀 SMASHED</span>' : ''}
                  </div>
                  <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">${p.monster}</span>
                </div>
                
                <div class="flex gap-2.5 text-center shrink-0">
                    ${renderStat(p.id, 'hp', p.hp, 'text-red-500')}
                    ${renderStat(p.id, 'vp', p.vp, 'text-yellow-400')}
                    ${renderStat(p.id, 'energy', p.energy, 'text-emerald-400')}
                </div>
            </div>

            <div class="flex items-center justify-between gap-2 border-t border-zinc-800/60 pt-2 ${isEliminated ? 'hidden' : ''}">
                <div class="flex gap-1">
                    <button onclick="toggleLocation(${p.id}, 'tokyo')" class="px-2.5 py-1 rounded-lg text-[10px] font-comic-heavy tracking-wide transition-all border ${inCity ? 'bg-purple-600 border-purple-400 text-white animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}">
                      👑 CITY
                    </button>
                    ${gameState.harborAvailable ? `
                      <button onclick="toggleLocation(${p.id}, 'harbor')" class="px-2.5 py-1 rounded-lg text-[10px] font-comic-heavy tracking-wide transition-all border ${inHarbor ? 'bg-sky-600 border-sky-400 text-white animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}">
                        ⚓ HARBOR
                      </button>
                    ` : ''}
                </div>

                <button onclick="event.stopPropagation(); toggleStatusDrawer(${p.id})" class="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition-all max-w-[60%] overflow-hidden">
                    <div class="flex gap-1 overflow-hidden">
                        ${activePreviewsHtml || '<span class="text-[9px] font-bold text-zinc-600 uppercase px-1">No Effects</span>'}
                    </div>
                    <span class="text-zinc-500 font-black text-[10px] px-1 select-none border-l border-zinc-800/80">${isDrawerOpen ? '▲' : '▼'}</span>
                </button>
            </div>

            ${isDrawerOpen && !isEliminated ? `
                <div class="flex flex-col gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 animate-fade-in mt-0.5">
                    
                    <div class="grid grid-cols-3 gap-1 text-center font-bold text-[9px] tracking-tight">
                        <button onclick="event.stopPropagation(); togglePlayerStatus(${p.id}, 'zombie')" class="py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${isZombie ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}" style="content-visibility: auto">
                          ${STATUS_ICONS.zombie} ZOMBIE
                        </button>
                        <button onclick="event.stopPropagation(); togglePlayerStatus(${p.id}, 'armor')" class="py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${hasArmor ? 'bg-amber-600 border-amber-400 text-white shadow-sm' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}" style="content-visibility: auto">
                          ${STATUS_ICONS.armor} ARMOR
                        </button>
                        <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'mimic', 0)" class="py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${hasMimic ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}" style="content-visibility: auto">
                          ${STATUS_ICONS.mimic} MIMIC
                        </button>
                    </div>

                    <div class="grid grid-cols-3 gap-1.5 text-center mt-1">
                        <div class="flex flex-col bg-zinc-900 rounded-xl p-1.5 border border-zinc-800/60 gap-1">
                          <div class="flex items-center gap-1 justify-center text-[8px] font-black text-lime-400 tracking-wider">
                            ${STATUS_ICONS.poison} POISON
                          </div>
                          <div class="flex items-center justify-between px-1.5 bg-zinc-950/40 rounded-md py-0.5">
                            <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'poison', -1)" class="text-zinc-500 font-black text-sm px-1 select-none">-</button>
                            <span class="text-xs font-black text-zinc-200">${poisonCount}</span>
                            <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'poison', 1)" class="text-zinc-500 font-black text-sm px-1 select-none">+</button>
                          </div>
                        </div>

                        <div class="flex flex-col bg-zinc-900 rounded-xl p-1.5 border border-zinc-800/60 gap-1">
                          <div class="flex items-center gap-1 justify-center text-[8px] font-black text-sky-400 tracking-wider">
                            ${STATUS_ICONS.shrink} SHRINK
                          </div>
                          <div class="flex items-center justify-between px-1.5 bg-zinc-950/40 rounded-md py-0.5">
                            <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'shrink', -1)" class="text-zinc-500 font-black text-sm px-1 select-none">-</button>
                            <span class="text-xs font-black text-zinc-200">${shrinkCount}</span>
                            <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'shrink', 1)" class="text-zinc-500 font-black text-sm px-1 select-none">+</button>
                          </div>
                        </div>

                        <div class="flex flex-col bg-zinc-900 rounded-xl p-1.5 border border-zinc-800/60 gap-1">
                          <div class="flex items-center gap-1 justify-center text-[8px] font-black text-zinc-400 tracking-wider">
                            ${STATUS_ICONS.smoke} SMOKE
                          </div>
                          <div class="flex items-center justify-between px-1.5 bg-zinc-950/40 rounded-md py-0.5">
                            <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'smoke', -1)" class="text-zinc-500 font-black text-sm px-1 select-none">-</button>
                            <span class="text-xs font-black text-zinc-200">${smokeCount}</span>
                            <button onclick="event.stopPropagation(); changePlayerToken(${p.id}, 'smoke', 1)" class="text-zinc-500 font-black text-sm px-1 select-none">+</button>
                          </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            ${showStagingDrawer && !isEliminated ? `
                <div class="mt-1.5 border-t border-zinc-800 pt-2.5 flex flex-col gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    <div class="text-[10px] font-comic-heavy text-yellow-400 uppercase tracking-wider flex justify-between px-0.5">
                        <span>🎲 Staging Area</span>
                        <span class="text-zinc-500">Tweak for Card Effects</span>
                    </div>
                    
                    <div class="grid grid-cols-4 gap-1 text-center bg-zinc-900/40 p-1.5 rounded-lg border border-zinc-900">
                        <div class="flex flex-col items-center">
                            <span class="text-[8px] font-black text-yellow-400 uppercase">⭐ VP</span>
                            <span class="text-lg font-black text-white">${gameState.turnStaging.vp}</span>
                            <div class="flex gap-1 mt-0.5">
                                <button onclick="tweakStaging('vp', -1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('vp', 1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[8px] font-black text-red-500 uppercase">💚 HP</span>
                            <span class="text-lg font-black text-white">${gameState.turnStaging.hp}</span>
                            <div class="flex gap-1 mt-0.5">
                                <button onclick="tweakStaging('hp', -1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('hp', 1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[8px] font-black text-emerald-400 uppercase">⚡ ENG</span>
                            <span class="text-lg font-black text-white">${gameState.turnStaging.energy}</span>
                            <div class="flex gap-1 mt-0.5">
                                <button onclick="tweakStaging('energy', -1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('energy', 1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">+</button>
                            </div>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[8px] font-black text-orange-500 uppercase">💥 DMG</span>
                            <span class="text-lg font-black text-white">${gameState.turnStaging.damage}</span>
                            <div class="flex gap-1 mt-0.5">
                                <button onclick="tweakStaging('damage', -1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">-</button>
                                <button onclick="tweakStaging('damage', 1)" class="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-bold">+</button>
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
        <div class="flex flex-col items-center w-11">
            <span class="text-[8px] uppercase tracking-wider ${colorClass}/70 font-black">${stat}</span>
            <span class="text-xl font-black ${colorClass} leading-none my-0.5">${value}</span>
            <div class="flex gap-1 mt-0.5">
                <button onclick="changeScoreStat(${id}, '${stat}', -1)" class="bg-neutral-800 border border-black px-1.5 py-0.5 rounded text-[10px] font-bold select-none leading-none">-</button>
                <button onclick="changeScoreStat(${id}, '${stat}', 1)" class="bg-neutral-800 border border-black px-1.5 py-0.5 rounded text-[10px] font-bold select-none leading-none">+</button>
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
  if (die.held) block.classList.add('bg-zinc-900', 'border-emerald-500/80');
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
