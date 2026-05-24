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

