// Data Layer
let gameState = {
    players: [
        { id: 0, name: "Gigazaur", hp: 10, vp: 0, energy: 0 },
        { id: 1, name: "Kraken", hp: 10, vp: 0, energy: 0 }
    ]
};

// Logic Layer
function changeScoreStat(playerId, stat, amount) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
        player[stat] = Math.max(0, player[stat] + amount);
        renderScoreboard();
    }
}

// Rendering Layer
function renderScoreboard() {
    const container = document.getElementById('player-grid');
    if (!container) return;
    
    container.innerHTML = gameState.players.map(p => `
        <div class="bg-neutral-900 border-2 border-black p-4 rounded-xl flex justify-between items-center shadow-[4px_4px_0px_#000000]">
            <span class="font-bold uppercase text-lg">${p.name}</span>
            <div class="flex gap-4 text-center">
                ${renderStat(p.id, 'hp', p.hp, 'red-500')}
                ${renderStat(p.id, 'vp', p.vp, 'yellow-400')}
                ${renderStat(p.id, 'energy', p.energy, 'emerald-400')}
            </div>
        </div>
    `).join('');
}

function renderStat(id, stat, value, color) {
    return `
        <div class="flex flex-col items-center">
            <span class="text-[9px] uppercase tracking-wider text-${color}/70">${stat}</span>
            <div class="flex items-center gap-1">
                <button onclick="changeScoreStat(${id}, '${stat}', -1)" class="text-xs font-bold px-2">-</button>
                <span class="text-xl font-black text-${color}">${value}</span>
                <button onclick="changeScoreStat(${id}, '${stat}', 1)" class="text-xs font-bold px-2">+</button>
            </div>
        </div>
    `;
}
// ==========================================
// 1. MASTER DATA LAYER (Model)
// ==========================================
let gameState = {
    players: [
        { id: 0, name: "Gigazaur", hp: 10, vp: 0, energy: 0 },
        { id: 1, name: "Kraken", hp: 10, vp: 0, energy: 0 },
        { id: 2, name: "Meka Dragon", hp: 10, vp: 0, energy: 0 }
    ]
};

let turnRollCount = 0;
let poolSize = 6;
let diceArray = [];
let executionLock = false;

const FACES = ['damage', 'destruction', 'energy', 'fame', 'ability', 'health'];

const SVG_ASSETS = {
  damage: `<svg viewBox="0 0 100 100" class="w-5/6 h-5/6 text-red-500 fill-current"><circle cx="50" cy="62" r="16"/><path d="M26,44 C21,34 31,24 36,36 Z"/><path d="M42,30 C41,16 53,14 53,28 Z"/><path d="M60,32 C64,16 75,22 70,36 Z"/><path d="M76,48 C83,40 90,52 80,58 Z"/></svg>`,
  destruction: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-sky-400 fill-current"><path d="M30,90 L30,15 L70,15 L70,90 Z" /><rect x="38" y="25" width="8" height="12" fill="#18181b"/><rect x="54" y="25" width="8" height="12" fill="#18181b"/><rect x="38" y="47" width="8" height="12" fill="#18181b"/><rect x="54" y="47" width="8" height="12" fill="#18181b"/><rect x="38" y="69" width="8" height="12" fill="#18181b"/><rect x="54" y="69" width="8" height="12" fill="#18181b"/></svg>`,
  energy: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-yellow-400 fill-current"><polygon points="62,8 24,54 52,54 38,92 76,46 48,46"/></svg>`,
  fame: `<svg viewBox="0 0 100 100" class="w-5/6 h-5/6 text-purple-400 fill-current"><polygon points="50,8 63,38 96,38 69,58 79,90 50,70 21,90 31,58 4,38 37,38"/></svg>`,
  ability: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-orange-500 fill-current"><path d="M50,10 C27.9,10 10,27.9 10,50 C10,72.1 27.9,90 50,90 C72.1,90 90,72.1 90,50 C90,27.9 72.1,10 50,10 Z M50,22 C54.4,22 55,26 54,48 C53.5,58 46.5,58 46,48 C45,26 45.6,22 50,22 Z M50,78 C45.6,78 44,74.4 44,70 C44,65.6 45.6,62 50,62 C54.4,62 56,65.6 56,70 C56,74.4 54.4,78 50,78 Z" fill-rule="evenodd"/></svg>`,
  health: `<svg viewBox="0 0 100 100" class="w-4/5 h-4/5 text-emerald-500 fill-current"><path d="M50,84 C50,84 14,60 14,36 C14,18 32,10 50,28 C68,10 86,18 86,36 C86,60 50,84 50,84 Z"/></svg>`
};

// ==========================================
// 2. SCORE & STATE CONTROLLER LOGIC
// ==========================================
function changeScoreStat(playerId, stat, amount) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
        player[stat] = Math.max(0, player[stat] + amount);
        renderScoreboard();
    }
}

// ==========================================
// 3. DICE ENGINE LOGIC
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
      rollTargets.forEach(die => {
        die.isShuffling = false;
        die.face = FACES[Math.floor(Math.random() * FACES.length)];
      });
      executionLock = false;
      renderTable();
    }
  }, speedStep);
}

// ==========================================
// 4. UI RENDERING LAYER (View)
// ==========================================
function showTab(targetTab) {
  document.getElementById('tab-score-view').classList.toggle('hidden', targetTab !== 'score');
  document.getElementById('tab-dice-view').classList.toggle('hidden', targetTab !== 'dice');
  if (targetTab === 'dice') renderTable();
}

function renderScoreboard() {
    const container = document.getElementById('player-grid');
    if (!container) return;
    
    container.innerHTML = gameState.players.map(p => `
        <div class="bg-neutral-900 border-2 border-black p-4 rounded-xl flex justify-between items-center shadow-[4px_4px_0px_#000000]">
            <span class="font-bold uppercase text-lg">${p.name}</span>
            <div class="flex gap-4 text-center">
                ${renderStat(p.id, 'hp', p.hp, 'text-red-500')}
                ${renderStat(p.id, 'vp', p.vp, 'text-yellow-400')}
                ${renderStat(p.id, 'energy', p.energy, 'text-emerald-400')}
            </div>
        </div>
    `).join('');
}

function renderStat(id, stat, value, colorClass) {
    return `
        <div class="flex flex-col items-center w-14">
            <span class="text-[9px] uppercase tracking-wider ${colorClass}/70 font-bold">${stat}</span>
            <span class="text-2xl font-black ${colorClass}">${value}</span>
            <div class="flex gap-2 mt-1">
                <button onclick="changeScoreStat(${id}, '${stat}', -1)" class="bg-neutral-800 border border-black px-2 py-0.5 rounded text-xs">-</button>
                <button onclick="changeScoreStat(${id}, '${stat}', 1)" class="bg-neutral-800 border border-black px-2 py-0.5 rounded text-xs">+</button>
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

