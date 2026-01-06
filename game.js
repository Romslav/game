// Telegram init
if (typeof Telegram !== 'undefined') {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}

// Константы
const HERO_COLORS = { ironman: '#C83232', thor: '#FFFF64', hulk: '#32A852' };

const CHEST_REWARDS = {
    bronze:    [{gold:150,chance:60},{gold:300,chance:30},{skin:'common',chance:8},{skin:'uncommon',chance:2}],
    silver:    [{gold:800,chance:55},{gems:2,chance:35},{skin:'common',chance:7},{skin:'uncommon',chance:3}],
    gold:      [{gems:8,chance:40},{gold:2500,chance:48},{skin:'uncommon',chance:6},{skin:'rare',chance:4}],
    epic:      [{gems:20,chance:40},{gold:5000,chance:45},{skin:'rare',chance:8},{skin:'epic',chance:5},{skin:'legendary',chance:2}],
    legendary: [{gems:40,chance:35},{gold:10000,chance:45},{skin:'epic',chance:8},{skin:'legendary',chance:4},{skin:'godly',chance:2},{skin:'limited',chance:1}],
    godly:     [{gems:100,chance:30},{gold:25000,chance:40},{skin:'legendary',chance:12},{skin:'godly',chance:4},{skin:'limited',chance:3}],
    ultimate:  [{gems:150,chance:30},{gold:50000,chance:35},{skin:'legendary',chance:12},{skin:'godly',chance:5},{skin:'limited',chance:3}]
};

// ====== КЛАСС ИГРЫ ======
class MarvelUltronGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.player = {
            gold: 5000,
            gems: 10,
            skins: {ironman:['classic'], thor:['classic'], hulk:['classic']},
            equippedSkins: {ironman:'classic'}
        };

        this.gameState = 'menu'; // menu / market / playing
        this.marketTab = 0;
        this.selectedHero = 'ironman';
        this.score = 0;
        this.level = 1;

        this.cannon = { x: 100, y: this.canvas.height - 120, angle: -0.3, power: 15 };
        this.heroes = [];
        this.ultrons = [];
        this.particles = [];

        this.initMarket();
        this.initDailySystem();
        this.initControls();
        this.gameLoop();
    }

    // ---------- ИНИЦИАЛИЗАЦИЯ ----------
    initMarket() {
        window.SHOP_ITEMS = {
            'double_score': {
                name:'x2 Очки (1 матч)',
                price:{gold:1000},
                cat:'boosters',
                rarity:'rare'
            },
            'ironman_mark50': {
                name:'Iron Man Mark 50',
                price:{gold:5000},
                cat:'skins',
                hero:'ironman',
                rarity:'legendary'
            },
            'thor_stormbreaker': {
                name:'Thor Stormbreaker',
                price:{gems:25},
                cat:'skins',
                hero:'thor',
                rarity:'epic'
            },
            'power_boost': {
                name:'+50% сила выстрела',
                price:{gems:10},
                cat:'boosters',
                rarity:'epic'
            }
        };
    }

    initDailySystem() {
        this.dailyRewards = [
            {day:1, gold:150, gems:1, name:'Добро пожаловать!'},
            {day:2, chest:'bronze', name:'Бронзовый сундук'},
            {day:3, chest:'bronze', name:'Ещё бронза'},
            {day:4, chest:'silver', name:'Серебряный сундук'},
            {day:5, gems:3, chest:'bronze', name:'Gems + Бронза'},
            {day:6, chest:'silver', name:'Серебро!'},
            {day:7, chest:'gold', name:'Первый GOLD'},
            {day:30, chest:'godly', gold:15000, gems:75, name:'🎉 ФИНАЛ!'}
        ];
        this.streak = 0;
        this.lastClaim = null;
    }

    initControls() {
        document.getElementById('shopTab').onclick   = () => this.marketTab = 0;
        document.getElementById('p2pTab').onclick    = () => this.marketTab = 1;
        document.getElementById('auctionTab').onclick= () => this.marketTab = 2;

        document.getElementById('dailyBtn').onclick  = () => this.claimDaily();

        document.getElementById('challengeBtn').onclick = () => this.startDuel();
        document.getElementById('shareBtn').onclick     = () => this.shareScore();

        this.canvas.onclick = (e) => {
            if (this.gameState !== 'market') return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const item = this.getItemAt(x, y);
            if (item) this.buyItem(item);
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'm') this.gameState = (this.gameState === 'market' ? 'menu' : 'market');
            if (e.key >= '1' && e.key <= '3') this.marketTab = parseInt(e.key) - 1;
        });

        window.addEventListener('resize', () => this.resize());
    }

    // ---------- ЕЖЕДНЕВНЫЕ БОНУСЫ ----------
    claimDaily() {
        const todayStr = new Date().toDateString();
        const todayDay = new Date().getDate();

        if (this.lastClaim === todayStr) {
            alert('📅 Бонус уже получен сегодня!');
            return;
        }

        if (!this.lastClaim) {
            this.streak = 1;
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (this.lastClaim === yesterday.toDateString()) {
                this.streak++;
            } else {
                this.streak = 1;
            }
        }

        const reward = this.dailyRewards.find(r => r.day === todayDay) || this.dailyRewards[0];
        const mult = 1 + this.streak * 0.25;

        if (reward.gold) this.player.gold += Math.floor(reward.gold * mult);
        if (reward.gems) this.player.gems += Math.floor(reward.gems * mult);
        if (reward.chest) this.openChest(reward.chest);

        this.lastClaim = todayStr;
        document.getElementById('streakCounter').textContent = `Стreak: ${this.streak} 🔥`;
        alert(`🎉 ${reward.name} (x${mult.toFixed(1)})`);
    }

    openChest(type) {
        const rewards = CHEST_REWARDS[type] || CHEST_REWARDS.bronze;
        const roll = Math.random() * 100;
        let sum = 0;
        for (const r of rewards) {
            sum += r.chance;
            if (roll <= sum) {
                if (r.gold) this.player.gold += r.gold;
                if (r.gems) this.player.gems += r.gems;
                if (r.skin) {
                    const skinName = this.getSkinByRarity(r.skin);
                    const hero = this.selectedHero;
                    if (!this.player.skins[hero]) this.player.skins[hero] = [];
                    this.player.skins[hero].push(skinName);
                }
                alert(`📦 ${type.toUpperCase()}: ${
                    r.gold ? r.gold + 'G' :
                    r.gems ? r.gems + '💎' :
                    'Skin: ' + r.skin
                }`);
                break;
            }
        }
    }

    getSkinByRarity(rarity) {
        const skins = {
            common:   ['classic_red', 'classic_blue'],
            uncommon: ['war_machine', 'stealth'],
            rare:     ['mark50', 'mark85'],
            epic:     ['arc_reactor', 'repulsor'],
            legendary:['nanotech', 'unibeam'],
            godly:    ['overload', 'apocalypse'],
            limited:  ['lunar_2026', 'valentines']
        };
        const list = skins[rarity] || skins.common;
        return list[Math.floor(Math.random() * list.length)];
    }

    // ---------- РЫНОК ----------
    getItemAt(x, y) {
        const items = Object.values(window.SHOP_ITEMS).slice(0, 8);
        for (let i = 0; i < items.length; i++) {
            const itemX = 60 + (i % 2) * 240;
            const itemY = 180 + Math.floor(i / 2) * 150;
            if (x >= itemX && x <= itemX + 90 && y >= itemY + 100 && y <= itemY + 130) {
                return items[i];
            }
        }
        return null;
    }

    buyItem(item) {
        if (item.price.gold && this.player.gold >= item.price.gold) {
            this.player.gold -= item.price.gold;
        } else if (item.price.gems && this.player.gems >= item.price.gems) {
            this.player.gems -= item.price.gems;
        } else {
            alert('❌ Недостаточно средств!');
            return;
        }
        alert(`✅ ${item.name} куплен!`);
    }

    // ---------- СОЦИАЛКА ----------
    startDuel() {
        const username = Telegram?.WebApp?.initDataUnsafe?.user?.username || 'Player';
        const text = `⚔️ Дуэль! @${username} вызывает тебя в Marvel vs Ultron!`;
        Telegram?.WebApp?.shareUrl?.(text, window.location.href);
    }

    shareScore() {
        const text =
            `🚀 Marvel vs Ultron\n` +
            `💰 ${this.player.gold}G | 💎 ${this.player.gems}\n` +
            `Уровень ${this.level} | Стрик ${this.streak}`;
        Telegram?.WebApp?.shareUrl?.(text, window.location.href);
    }

    // ---------- РЕНДЕР ----------
    renderCurrency() {
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 22px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`💰 ${this.player.gold.toLocaleString()}G`, 20, 40);
        this.ctx.fillStyle = '#FF69B4';
        this.ctx.fillText(`💎 ${this.player.gems}`, 20, 70);
    }

    renderMarket() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.renderCurrency();

        const items = Object.values(window.SHOP_ITEMS).slice(0, 8);
        const rarityColors = {
            common:'#CCC', uncommon:'#4CAF50', rare:'#2196F3',
            epic:'#9C27B0', legendary:'#FFD700'
        };

        items.forEach((item, i) => {
            const x = 60 + (i % 2) * 240;
            const y = 180 + Math.floor(i / 2) * 150;

            this.ctx.fillStyle = (rarityColors[item.rarity] || '#666') + '40';
            this.ctx.fillRect(x - 10, y - 10, 220, 140);
            this.ctx.strokeStyle = rarityColors[item.rarity] || '#666';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x - 10, y - 10, 220, 140);

            this.ctx.fillStyle = item.color || '#FF5722';
            this.ctx.beginPath();
            this.ctx.arc(x + 30, y + 30, 25, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(item.name, x + 70, y + 35);

            this.ctx.fillStyle = item.price.gold ? '#FFD700' : '#FF69B4';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText(
                item.price.gold ? `${item.price.gold}G` : `${item.price.gems}💎`,
                x, y + 75
            );

            const canBuy = item.price.gold
                ? this.player.gold >= item.price.gold
                : this.player.gems >= item.price.gems;
            this.ctx.fillStyle = canBuy ? '#4CAF50' : '#666';
            this.ctx.fillRect(x, y + 105, 90, 30);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('КУПИТЬ', x + 45, y + 125);
        });
    }

    renderDailyWidget() {
        const today = new Date().getDate();
        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.fillRect(this.canvas.width - 260, 20, 240, 90);

        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`📅 День ${today}`, this.canvas.width - 140, 50);

        this.ctx.fillStyle =
            this.lastClaim === new Date().toDateString() ? '#4CAF50' : '#FF5722';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(
            this.lastClaim === new Date().toDateString() ? '✅ Получено' : '🎁 Доступно',
            this.canvas.width - 140,
            80
        );
    }

    renderGame() {
        const g = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        g.addColorStop(0, '#87CEEB');
        g.addColorStop(1, '#98D8E8');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, this.canvas.height - 80, this.canvas.width, 80);

        this.ctx.save();
        this.ctx.translate(this.cannon.x, this.cannon.y);
        this.ctx.rotate(this.cannon.angle);
        this.ctx.fillStyle = '#666';
        this.ctx.fillRect(0, -12, 80, 24);
        this.ctx.restore();

        this.renderCurrency();
    }

    render() {
        if (this.gameState === 'market') this.renderMarket();
        else this.renderGame();
        this.renderDailyWidget();
    }

    gameLoop() {
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cannon.y = this.canvas.height - 120;
    }
}

const game = new MarvelUltronGame();
window.game = game;
