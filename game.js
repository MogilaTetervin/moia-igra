window.onload = function() {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        scene: {
            preload: preload,
            create: create,
            update: update
        }
    };
    window.game = new Phaser.Game(config);
};

let player, cursors, bullets, enemies, enemyBullets, explosions, explosionWarnings;
let lastFired = 0, fireDelay = 800, score = 0, kills = 0, playerHealth = 3;
let scoreText, killsText, waveText, bossHealthBar, bossHealthText;
let enemyTypes, invincible = false, lastExplosionSpawn = 0;
let healthIcons = [], currentWave = 0, enemiesThisWave = 0, maxEnemiesThisWave = 3;
let waveActive = false, bossActive = false, boss = null, spawnTimer = null;

const WAVE_CONFIG = {
    baseEnemies: 3, enemiesPerWave: 2, baseSpawnDelay: 1000,
    minSpawnDelay: 300, bossWaveInterval: 5
};

let playerUpgrades = {
    fireRate: 1, damage: 1, speed: 1, bulletSpeed: 1, maxHealth: 3
};

const BASE_PLAYER_SPEED = 120;
// Убираем BULLET_BASE_SPEED из констант, будем использовать фиксированные значения

function preload() {
    this.load.image('player', 'assets/images/spaceShipsGG.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/enemy-bullet.png');
    this.load.image('enemy1', 'assets/images/spaceBuilding_011.png');
    this.load.image('enemy2', 'assets/images/spaceBuilding_013.png');
    this.load.image('enemy3', 'assets/images/spaceBuilding_024.png');
    this.load.image('boss1', 'assets/images/spaceBuilding_024.png');
    this.load.image('boss2', 'assets/images/spaceBuilding_013.png');
    this.load.image('boss3', 'assets/images/spaceBuilding_011.png');
    this.load.image('hp', 'assets/images/hp.png');
    this.load.image('lowhp', 'assets/images/Lowhp.png');
    
    createPixelShopIcons.call(this);
    
    // Создание фона
    let graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x000000).fillRect(0, 0, 800, 600);
    graphics.fillStyle(0xffffff);
    for (let i = 0; i < 200; i++) graphics.fillCircle(Math.random() * 800, Math.random() * 600, Math.random() * 2 + 1);
    graphics.fillStyle(0xffaa00);
    for (let i = 0; i < 30; i++) graphics.fillCircle(Math.random() * 800, Math.random() * 600, 1.5);
    graphics.fillStyle(0xaaaaff);
    for (let i = 0; i < 20; i++) graphics.fillCircle(Math.random() * 800, Math.random() * 600, 1.5);
    graphics.generateTexture('space', 800, 600);
    graphics.destroy();
}

function createPixelShopIcons() {
    // Иконка огня (для пулемёта)
    let fire = this.make.graphics({ x: 0, y: 0, add: false });
    fire.fillStyle(0xff5500);
    fire.fillRect(0, 4, 4, 2);
    fire.fillRect(2, 2, 4, 4);
    fire.fillRect(4, 0, 2, 2);
    fire.fillStyle(0xffaa00);
    fire.fillRect(2, 3, 2, 2);
    fire.generateTexture('shop-fire', 8, 8);
    
    // Иконка молнии (для урона)
    let lightning = this.make.graphics({ x: 0, y: 0, add: false });
    lightning.fillStyle(0xffff00);
    lightning.fillRect(2, 0, 2, 4);
    lightning.fillRect(4, 2, 2, 4);
    lightning.fillRect(0, 4, 2, 2);
    lightning.fillRect(6, 2, 2, 2);
    lightning.generateTexture('shop-lightning', 8, 8);
    
    // Иконка ракеты (для скорости)
    let rocket = this.make.graphics({ x: 0, y: 0, add: false });
    rocket.fillStyle(0xff6600);
    rocket.fillRect(2, 0, 4, 2);
    rocket.fillRect(1, 2, 6, 4);
    rocket.fillRect(3, 6, 2, 2);
    rocket.fillStyle(0xffaa00);
    rocket.fillRect(4, 3, 2, 2);
    rocket.generateTexture('shop-rocket', 8, 8);
    
    // Иконка пули (для скорости пуль)
    let bullet = this.make.graphics({ x: 0, y: 0, add: false });
    bullet.fillStyle(0x888888);
    bullet.fillRect(2, 0, 2, 2);
    bullet.fillRect(1, 2, 4, 4);
    bullet.fillRect(0, 6, 6, 2);
    bullet.fillStyle(0xcccccc);
    bullet.fillRect(3, 3, 2, 2);
    bullet.generateTexture('shop-bullet', 8, 8);
    
    // Иконка сердца (для аптечки)
    let heart = this.make.graphics({ x: 0, y: 0, add: false });
    heart.fillStyle(0xff0000);
    heart.fillRect(2, 0, 4, 2);
    heart.fillRect(0, 2, 8, 2);
    heart.fillRect(2, 4, 4, 2);
    heart.fillRect(4, 6, 2, 2);
    heart.generateTexture('shop-heart', 8, 8);
    
    // Иконка щита (для брони)
    let shield = this.make.graphics({ x: 0, y: 0, add: false });
    shield.fillStyle(0x00aaff);
    shield.fillRect(2, 0, 4, 2);
    shield.fillRect(1, 2, 6, 4);
    shield.fillRect(2, 6, 4, 2);
    shield.fillStyle(0xffffff);
    shield.fillRect(3, 3, 2, 2);
    shield.generateTexture('shop-shield', 8, 8);
}

function create() {
    this.spaceBackground = this.add.tileSprite(400, 300, 800, 600, 'space').setScrollFactor(0);
    
    player = this.physics.add.sprite(400, 300, 'player').setCollideWorldBounds(true).setScale(0.12);
    
    // НОВЫЙ ПОДХОД: создаем пули без ограничений
    bullets = this.physics.add.group({ 
        defaultKey: 'bullet',
        allowGravity: false,
        // Не ставим maxSize - пусть создаются новые
    });
    
    enemyBullets = this.physics.add.group({ 
        defaultKey: 'bullet',
        allowGravity: false 
    });
    
    enemies = this.physics.add.group();
    
    explosions = this.physics.add.group({ 
        defaultKey: 'bullet', 
        maxSize: 150,
        allowGravity: false 
    });
    
    explosionWarnings = this.physics.add.group({ 
        defaultKey: 'bullet', 
        maxSize: 150, 
        allowGravity: false 
    });
    
    enemyTypes = [
        { key: 'enemy1', speed: 70, health: 1, scale: 0.8, color: 0xff3333, name: 'ОБЫЧНЫЙ', reward: 5 },
        { key: 'enemy2', speed: 40, health: 4, scale: 1.2, color: 0x33ff33, name: 'ТАНК', reward: 15 },
        { key: 'enemy3', speed: 140, health: 1, scale: 0.6, color: 0x3333ff, name: 'БЫСТРЫЙ', reward: 8 }
    ];
    
    this.physics.add.collider(bullets, enemies, hitEnemy, null, this);
    this.physics.add.collider(player, enemies, playerHit, null, this);
    this.physics.add.overlap(explosions, enemies, explosionHitEnemy, null, this);
    this.physics.add.overlap(player, explosions, playerHitByExplosion, null, this);
    this.physics.add.overlap(player, enemyBullets, playerHitByBullet, null, this);
    
    cursors = this.input.keyboard.createCursorKeys();

    this.wasd = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    scoreText = this.add.text(10, 10, 'КРЕДИТЫ: 0', { fontSize: '16px', fill: '#0f0', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3 });
    killsText = this.add.text(10, 40, 'УБИЙСТВ: 0', { fontSize: '16px', fill: '#ff0', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3 });
    
    createHealthIcons.call(this);
    
    waveText = this.add.text(320, 10, 'ВОЛНА: 0', { fontSize: '20px', fill: '#ffaa00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4 });
    
    bossHealthBar = this.add.graphics().setVisible(false);
    bossHealthText = this.add.text(300, 70, 'БОСС', { fontSize: '16px', fill: '#ff0000', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3 }).setVisible(false);
    
    createHTMLShop();
    startNextWave.call(this);
}

function createHealthIcons() {
    healthIcons.forEach(icon => icon.destroy());
    healthIcons = [];
    for (let i = 0; i < playerUpgrades.maxHealth; i++) {
        let icon = this.add.image(10 + i * 35, 100, i < playerHealth ? 'hp' : 'lowhp').setScale(0.5);
        healthIcons.push(icon);
    }
}

function updateHealthIcons() {
    healthIcons.forEach((icon, i) => icon.setTexture(i < playerHealth ? 'hp' : 'lowhp'));
}

function refreshHealthIcons() {
    createHealthIcons.call(this);
}

function startNextWave() {
    if (bossActive) return;
    
    currentWave++;
    waveText.setText('ВОЛНА: ' + currentWave);
    
    enemies.clear(true, true);
    enemyBullets.clear(true, true);
    
    maxEnemiesThisWave = WAVE_CONFIG.baseEnemies + (currentWave - 1) * WAVE_CONFIG.enemiesPerWave;
    enemiesThisWave = 0;
    waveActive = true;
    
    let spawnDelay = Math.max(WAVE_CONFIG.minSpawnDelay, WAVE_CONFIG.baseSpawnDelay - currentWave * 50);
    showWaveMessage.call(this, currentWave);
    
    if (spawnTimer) spawnTimer.remove();
    spawnTimer = this.time.addEvent({ delay: spawnDelay, callback: spawnWaveEnemy, callbackScope: this, loop: true });
    
    if (currentWave % WAVE_CONFIG.bossWaveInterval === 0) {
        this.time.delayedCall(3000, () => { if (waveActive) spawnBoss.call(this); }, [], this);
    }
}

function showWaveMessage(waveNumber) {
    let msg = this.add.text(400, 300, `ВОЛНА ${waveNumber}`, { fontSize: '48px', fill: '#ffaa00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    this.tweens.add({ targets: msg, alpha: 0, y: 250, duration: 2000, ease: 'Power2', onComplete: () => msg.destroy() });
}

function spawnWaveEnemy() {
    if (!waveActive || bossActive || enemiesThisWave >= maxEnemiesThisWave) return;
    
    let type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    let side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * 800; y = -50; }
    else if (side === 1) { x = 850; y = Math.random() * 600; }
    else if (side === 2) { x = Math.random() * 800; y = 650; }
    else { x = -50; y = Math.random() * 600; }
    
    let bonus = Math.floor(currentWave / 3);
    let enemy = enemies.create(x, y, type.key).setScale(type.scale).setTint(type.color);
    enemy.setCollideWorldBounds(true).body.setBounce(0.5);
    
    let health = type.health;
    let speed = type.speed;
    if (type.name === 'ТАНК') health += bonus +5;
    if (type.name === 'БЫСТРЫЙ') speed += bonus * 5;
    
    enemy.enemyData = { health, speed, typeIndex: enemyTypes.indexOf(type), killed: false, reward: type.reward };
    enemiesThisWave++;
    
    if (enemiesThisWave >= maxEnemiesThisWave) { spawnTimer.remove(); spawnTimer = null; }
}

function spawnBoss() {
    if (bossActive) return;
    
    waveActive = false;
    if (spawnTimer) { spawnTimer.remove(); spawnTimer = null; }
    
    enemies.clear(true, true);
    enemyBullets.clear(true, true);
    bossActive = true;
    
    let type = Math.floor(currentWave / WAVE_CONFIG.bossWaveInterval) % 3;
    let bossKey, bossColor, bossName;
    
    // Усиление боссов в зависимости от волны
    let bossHealthMultiplier = 1 + (Math.floor(currentWave / WAVE_CONFIG.bossWaveInterval) * 0.5);
    let bossDamage = 1 + Math.floor(currentWave / WAVE_CONFIG.bossWaveInterval);
    
    if (type === 0) { 
        bossKey = 'boss1'; 
        bossColor = 0x800080; 
        bossName = 'ПОВЕЛИТЕЛЬ ТЬМЫ';
    }
    else if (type === 1) { 
        bossKey = 'boss2'; 
        bossColor = 0xff4500; 
        bossName = 'ОГНЕННЫЙ КОЛОСС';
    }
    else { 
        bossKey = 'boss3'; 
        bossColor = 0x00ffff; 
        bossName = 'ЛЕДЯНОЙ ТИТАН';
    }
    
    boss = enemies.create(400, 100, bossKey).setScale(2.0).setTint(bossColor).setCollideWorldBounds(true);
    boss.body.setBounce(0.2);
    
    // Усиленные характеристики босса
    let baseHealth = 15 + currentWave * 15;
    let baseSpeed = 60 + Math.floor(currentWave / 5) * 10;
    
    boss.enemyData = {
        health: baseHealth * bossHealthMultiplier, 
        maxHealth: baseHealth * bossHealthMultiplier,
        speed: baseSpeed, 
        reward: 100 + currentWave * 50,
        isBoss: true, 
        name: bossName,
        lastShot: 0, 
        shotDelay: Math.max(800, 1500 - Math.floor(currentWave / 2) * 50),
        direction: 1,
        damage: bossDamage,
        phase: 1,
        phase2Health: baseHealth * bossHealthMultiplier * 0.5
    };
    
    bossHealthBar.setVisible(true);
    bossHealthText.setVisible(true).setText(bossName);
    
    let msg = this.add.text(400, 200, `БОСС ПРИБЛИЖАЕТСЯ!\n${bossName}\nУРОВЕНЬ ${Math.floor(currentWave / WAVE_CONFIG.bossWaveInterval) + 1}`, 
        { fontSize: '24px', fill: '#ff0000', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5);
    this.tweens.add({ targets: msg, alpha: 0, y: 150, duration: 3000, ease: 'Power2', onComplete: () => msg.destroy() });
}

function updateBossHealthBar() {
    if (!boss?.active || !boss.enemyData) return;
    bossHealthBar.clear();
    let percent = boss.enemyData.health / boss.enemyData.maxHealth;
    bossHealthBar.fillStyle(0x333333).fillRect(200, 40, 400, 20);
    bossHealthBar.fillStyle(percent > 0.6 ? 0x00ff00 : percent > 0.3 ? 0xffff00 : 0xff0000).fillRect(200, 40, 400 * percent, 20);
    bossHealthBar.lineStyle(2, 0xffffff).strokeRect(200, 40, 400, 20);
    bossHealthText.setText(`${boss.enemyData.name}: ${Math.floor(boss.enemyData.health)}/${Math.floor(boss.enemyData.maxHealth)}`);
}

function createHTMLShop() {
    let container = document.getElementById('shop-items-container');
    let creditSpan = document.getElementById('credit-amount');
    if (!container) return;
    container.innerHTML = '';
    
    let items = [
        { id: 'fireRate', name: 'ПУЛЕМЁТ', desc: 'Скорость стрельбы', baseCost: 100, texture: 'shop-fire', maxLevel: 3, currentLevel: 1, upgrade: 'fireRate', effect: '+20% скорости', costMultiplier: 2 },
        { id: 'damage', name: 'СИЛОВОЕ ЯДРО', desc: 'Урон', baseCost: 150, texture: 'shop-lightning', maxLevel: 3, currentLevel: 1, upgrade: 'damage', effect: '+1 урон', costMultiplier: 2 },
        { id: 'speed', name: 'ДВИГАТЕЛИ', desc: 'Скорость', baseCost: 120, texture: 'shop-rocket', maxLevel: 3, currentLevel: 1, upgrade: 'speed', effect: '+15% скорости', costMultiplier: 2 },
        { id: 'bulletSpeed', name: 'РЕЛЬСА', desc: 'Скорость пуль', baseCost: 130, texture: 'shop-bullet', maxLevel: 5, currentLevel: 1, upgrade: 'bulletSpeed', effect: '+150 к скорости пуль', costMultiplier: 2 },
        { id: 'health', name: 'АПТЕЧКА', desc: 'Восстановить 1 HP', baseCost: 80, texture: 'shop-heart', upgrade: 'heal' },
        { id: 'maxHealth', name: 'БРОНЯ', desc: 'Макс. здоровье', baseCost: 200, texture: 'shop-shield', maxLevel: 2, currentLevel: 1, upgrade: 'maxHealth', effect: '+1 макс. HP', costMultiplier: 2.5 }
    ];
    
    let getCost = (item) => {
        if (item.upgrade === 'heal') return item.baseCost;
        let cost = item.baseCost;
        for (let i = 1; i < item.currentLevel; i++) cost = Math.floor(cost * item.costMultiplier);
        return cost;
    };
    
    items.forEach(item => {
        let div = document.createElement('div');
        div.className = 'shop-item';
        div.id = `shop-${item.id}`;
        
        // Создаем canvas для пиксельной иконки
        let canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        let ctx = canvas.getContext('2d');
        
        // Рисуем пиксельную иконку в canvas
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 32, 32);
        
        if (item.texture === 'shop-fire') {
            ctx.fillStyle = '#ff5500';
            ctx.fillRect(0, 16, 16, 8);
            ctx.fillRect(8, 8, 16, 16);
            ctx.fillRect(16, 0, 8, 8);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(8, 12, 8, 8);
        } else if (item.texture === 'shop-lightning') {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(8, 0, 8, 16);
            ctx.fillRect(16, 8, 8, 16);
            ctx.fillRect(0, 16, 8, 8);
            ctx.fillRect(24, 8, 8, 8);
        } else if (item.texture === 'shop-rocket') {
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(8, 0, 16, 8);
            ctx.fillRect(4, 8, 24, 16);
            ctx.fillRect(12, 24, 8, 8);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(16, 12, 8, 8);
        } else if (item.texture === 'shop-bullet') {
            ctx.fillStyle = '#888888';
            ctx.fillRect(8, 0, 8, 8);
            ctx.fillRect(4, 8, 16, 16);
            ctx.fillRect(0, 24, 24, 8);
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(12, 12, 8, 8);
        } else if (item.texture === 'shop-heart') {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(8, 0, 16, 8);
            ctx.fillRect(0, 8, 32, 8);
            ctx.fillRect(8, 16, 16, 8);
            ctx.fillRect(16, 24, 8, 8);
        } else if (item.texture === 'shop-shield') {
            ctx.fillStyle = '#00aaff';
            ctx.fillRect(8, 0, 16, 8);
            ctx.fillRect(4, 8, 24, 16);
            ctx.fillRect(8, 24, 16, 8);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(12, 12, 8, 8);
        }
        
        div.innerHTML = `
            <div class="item-icon" style="display: flex; justify-content: center; align-items: center;">
                <img src="${canvas.toDataURL()}" width="32" height="32" style="image-rendering: pixelated;">
            </div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                ${item.effect ? `<div class="item-desc">${item.effect}</div>` : ''}
                <div class="item-desc">${item.desc}</div>
                <div class="item-price">💰 ${getCost(item)}$</div>
                ${item.currentLevel ? `<div class="item-level">УРОВЕНЬ ${item.currentLevel}/${item.maxLevel}</div>` : ''}
            </div>
        `;
        
        div.onclick = () => {
            let scene = window.game.scene.scenes[0];
            if (!scene) return;
            
            if (item.upgrade === 'heal') {
                if (score >= item.baseCost && playerHealth < playerUpgrades.maxHealth) {
                    score -= item.baseCost;
                    playerHealth++;
                    updateHealthIcons.call(scene);
                    showNotification('❤️ ЗДОРОВЬЕ ВОССТАНОВЛЕНО!');
                    scoreText.setText('КРЕДИТЫ: ' + score);
                } else showNotification('❌ НЕДОСТАТОЧНО КРЕДИТОВ!');
            } else if (!item.maxLevel || item.currentLevel < item.maxLevel) {
                let cost = getCost(item);
                if (score >= cost) {
                    score -= cost;
                    playerUpgrades[item.upgrade]++;
                    item.currentLevel++;
                    
                    if (item.upgrade === 'fireRate') {
                        fireDelay = Math.max(200, 800 / playerUpgrades.fireRate);
                    }
                    else if (item.upgrade === 'maxHealth') {
                        playerUpgrades.maxHealth++;
                        playerHealth = playerUpgrades.maxHealth;
                        refreshHealthIcons.call(scene);
                    }
                    
                    showNotification(`✅ ${item.name} УЛУЧШЕН!`);
                    scoreText.setText('КРЕДИТЫ: ' + score);
                } else showNotification('❌ НЕДОСТАТОЧНО КРЕДИТОВ!');
            } else showNotification('❌ МАКС. УРОВЕНЬ!');
            
            updateShopDisplay();
        };
        
        container.appendChild(div);
    });
    
    let updateShopDisplay = () => {
        if (creditSpan) creditSpan.textContent = score;
        items.forEach(item => {
            let el = document.getElementById(`shop-${item.id}`);
            if (!el) return;
            let cost = getCost(item);
            let canAfford = score >= cost;
            if (item.upgrade === 'heal') el.classList.toggle('disabled', !canAfford || playerHealth >= playerUpgrades.maxHealth);
            else el.classList.toggle('disabled', !canAfford || (item.maxLevel && item.currentLevel >= item.maxLevel));
            
            let priceSpan = el.querySelector('.item-price');
            if (priceSpan) priceSpan.innerHTML = `💰 ${cost}$`;
            let levelSpan = el.querySelector('.item-level');
            if (levelSpan && item.currentLevel) levelSpan.innerHTML = `УРОВЕНЬ ${item.currentLevel}/${item.maxLevel}`;
        });
    };
    
    window.updateShopDisplay = updateShopDisplay;
    updateShopDisplay();
}

function showNotification(text) {
    let notif = document.getElementById('notification');
    if (!notif) return;
    notif.style.display = 'block';
    notif.className = 'notification';
    notif.textContent = text;
    setTimeout(() => notif.style.display = 'none', 2000);
}

function update(time) {
    if (this.spaceBackground) {
        this.spaceBackground.tilePositionX += 0.1;
        this.spaceBackground.tilePositionY += 0.05;
    }
    
    let speed = BASE_PLAYER_SPEED * (0.8 + playerUpgrades.speed * 0.2);
    
    // УПРАВЛЕНИЕ: СТРЕЛКИ + WASD
    let moveX = 0;
    let moveY = 0;
    
    // Стрелки
    if (cursors.left.isDown) moveX = -1;
    if (cursors.right.isDown) moveX = 1;
    if (cursors.up.isDown) moveY = -1;
    if (cursors.down.isDown) moveY = 1;
    
    // WASD
    if (this.wasd.left.isDown) moveX = -1;
    if (this.wasd.right.isDown) moveX = 1;
    if (this.wasd.up.isDown) moveY = -1;
    if (this.wasd.down.isDown) moveY = 1;
    
    // Нормализуем диагональную скорость
    if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7;
        moveY *= 0.7;
    }
    
    player.setVelocity(moveX * speed, moveY * speed);
    
    // Поворот игрока
    if (moveX !== 0 || moveY !== 0) {
        let targetAngle = Math.atan2(moveY, moveX) * 180 / Math.PI + 90;
        let diff = targetAngle - player.angle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        if (Math.abs(diff) > 0.5) player.angle += Math.min(5, Math.max(-5, diff));
    }
    
    // Стрельба
    if (time > lastFired) { 
        shoot.call(this); 
        lastFired = time + fireDelay; 
    }
    
    // Движение врагов
    enemies.children.iterate(e => {
        if (!e?.active || !e.enemyData) return;
        
        if (e.enemyData.isBoss) {
            let dx = player.x - e.x;
            let dy = player.y - e.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let angle = Math.atan2(dy, dx);
            let bossSpeed = e.enemyData.speed;
            
            // Проверка на вторую фазу босса
            if (e.enemyData.phase === 1 && e.enemyData.health < e.enemyData.phase2Health) {
                e.enemyData.phase = 2;
                e.enemyData.speed *= 1.3;
                e.enemyData.shotDelay *= 0.7;
                e.setTint(0xff0000);
                
                let phaseMsg = this.add.text(400, 250, 'ВТОРАЯ ФАЗА!', 
                    { fontSize: '28px', fill: '#ff0000', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
                this.tweens.add({ targets: phaseMsg, alpha: 0, y: 200, duration: 2000, ease: 'Power2', onComplete: () => phaseMsg.destroy() });
            }
            
            // Поведение босса
            if (dist > 250) {
                e.setVelocity(Math.cos(angle) * bossSpeed, Math.sin(angle) * bossSpeed);
            } else if (dist < 150) {
                e.setVelocity(Math.cos(angle + Math.PI) * bossSpeed, Math.sin(angle + Math.PI) * bossSpeed);
            } else {
                e.setVelocity(Math.cos(angle + Math.PI/2) * bossSpeed * 0.7, Math.sin(angle + Math.PI/2) * bossSpeed * 0.7);
            }
            
            // Стрельба босса
            if (time > (e.enemyData.lastShot || 0)) {
                let bulletCount = e.enemyData.phase === 2 ? 5 : 3;
                for (let i = 0; i < bulletCount; i++) {
                    let angleOffset = (i - (bulletCount-1)/2) * 30;
                    shootEnemyBullet.call(this, e, angleOffset * 5, angleOffset);
                }
                e.enemyData.lastShot = time + e.enemyData.shotDelay;
            }
        } else {
            let angle = Math.atan2(player.y - e.y, player.x - e.x);
            let spd = e.enemyData.speed || 70;
            e.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
            e.angle = angle * 180 / Math.PI + 90;
        }
    }, this);
    
    // Очистка старых пуль
    bullets.children.iterate(b => {
        if (b?.active && (b.y > 650 || b.y < -50 || b.x > 850 || b.x < -50)) {
            b.destroy(); // Полностью уничтожаем, а не просто деактивируем
        }
    });
    
    enemyBullets.children.iterate(b => {
        if (b?.active && (b.y > 650 || b.y < -50 || b.x > 850 || b.x < -50)) {
            b.destroy();
        }
    });
    
    if (time > lastExplosionSpawn) { spawnExplosionSequence.call(this); lastExplosionSpawn = time + 8000; }
    
    explosionWarnings.children.iterate(w => {
        if (w?.active) {
            w.setScale(w.scaleX + 0.01).setAlpha(w.alpha - 0.005);
            if (w.alpha <= 0) w.destroy();
        }
    });
    
    explosions.children.iterate(ex => {
        if (ex?.active) {
            ex.setScale(ex.scaleX + 0.02).setAlpha(ex.alpha - 0.01);
            if (ex.alpha <= 0) { 
                ex.destroy();
            }
        }
    });
    
    if (bossActive && boss?.active) updateBossHealthBar.call(this);
    
    if (waveActive && enemies.countActive(true) === 0 && enemiesThisWave >= maxEnemiesThisWave) {
        waveActive = false;
        if (bossActive) return;
        this.time.delayedCall(3000, () => startNextWave.call(this), [], this);
        let msg = this.add.text(400, 300, 'ВОЛНА ПРОЙДЕНА!', { fontSize: '32px', fill: '#0f0', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this.tweens.add({ targets: msg, alpha: 0, y: 250, duration: 2000, ease: 'Power2', onComplete: () => msg.destroy() });
    }
}

function shoot() {
    // ПРОСТОЙ И НАДЕЖНЫЙ СПОСОБ: создаем новую пулю каждый раз
    let bullet = bullets.create(player.x, player.y, 'bullet');
    
    if (!bullet) {
        console.log("Не удалось создать пулю");
        return;
    }
    
    // Настраиваем пулю
    bullet.setActive(true).setVisible(true).setScale(0.5).setTint(0xffaa00);
    bullet.damage = playerUpgrades.damage;
    
    // Включаем физику
    this.physics.world.enable(bullet);
    bullet.body.setCircle(5);
    bullet.body.setAllowGravity(false);
    
    // Находим ближайшего врага
    let nearest = null, dist = Infinity;
    enemies.children.iterate(e => {
        if (e?.active) {
            let d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
            if (d < dist) { dist = d; nearest = e; }
        }
    });
    
    // ФИКСИРОВАННАЯ СКОРОСТЬ: базовая 600 + 150 за уровень
    let speed = 600 + (playerUpgrades.bulletSpeed - 1) * 150;
    
    let angle;
    if (nearest) {
        angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, nearest.x, nearest.y);
    } else {
        angle = (player.angle - 90) * Math.PI / 180;
    }
    
    bullet.rotation = angle;
    bullet.body.velocity.x = Math.cos(angle) * speed;
    bullet.body.velocity.y = Math.sin(angle) * speed;
    
    // Уничтожаем пулю через 2 секунды
    this.time.delayedCall(2000, () => {
        if (bullet && bullet.active) {
            bullet.destroy();
        }
    });
}

function shootEnemyBullet(enemy, offsetX = 0, angleOffset = 0) {
    if (!enemy?.active) return;
    
    let bullet = enemyBullets.create(enemy.x + offsetX, enemy.y + 30, 'bullet');
    
    if (!bullet) return;
    
    bullet.setActive(true).setVisible(true).setScale(0.4).setTint(0xff3333);
    
    this.physics.world.enable(bullet);
    bullet.body.setCircle(5);
    bullet.body.setAllowGravity(false);
    
    // Пули врагов летят в игрока
    let angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, player.x, player.y);
    angle += angleOffset * Math.PI / 180;
    
    let speed = 250 + (currentWave * 10);
    
    bullet.rotation = angle;
    bullet.body.velocity.x = Math.cos(angle) * speed;
    bullet.body.velocity.y = Math.sin(angle) * speed;
    
    this.time.delayedCall(3000, () => {
        if (bullet && bullet.active) {
            bullet.destroy();
        }
    });
}

function playerHitByBullet(player, bullet) {
    if (invincible || !bullet?.active) return;
    
    bullet.destroy();
    
    playerHealth--;
    updateHealthIcons.call(this);
    player.setTint(0xff0000);
    invincible = true;
    this.time.delayedCall(1500, () => { invincible = false; if (player?.active) player.clearTint(); });
    if (playerHealth <= 0) gameOver.call(this, player, null);
}

function spawnExplosionSequence() {
    let x = player.x;
    let y = player.y + 50; 
    
    let warningText = this.add.text(x, y - 70, '⚠ ВНИМАНИЕ ⚠', { 
        fontSize: '16px', 
        fill: '#ff0000', 
        fontFamily: '"Press Start 2P"',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5);
    
    this.tweens.add({
        targets: warningText,
        alpha: 0,
        y: y - 100,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => warningText.destroy()
    });
    
    for (let i = 0; i < 16; i++) {
        let angle = (i / 16) * Math.PI * 2;
        let radius = 40;
        let wx = x + Math.cos(angle) * radius;
        let wy = y + Math.sin(angle) * radius;
        
        let warning = explosionWarnings.create(wx, wy, 'bullet');
        if (warning) {
            warning.setActive(true).setVisible(true);
            warning.setScale(0.3);
            warning.setTint(0xff0000);
            warning.setAlpha(0.9);
            
            this.tweens.add({
                targets: warning,
                scale: 0.8,
                alpha: 0,
                duration: 2200,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (warning.active) warning.destroy();
                }
            });
        }
    }
    
    this.time.delayedCall(2280, () => {
        for (let i = 0; i < 12; i++) {
            let offsetX = Phaser.Math.Between(-70, 70);
            let offsetY = Phaser.Math.Between(-70, 70);
            
            let ex = explosions.create(x + offsetX, y + offsetY, 'bullet');
            
            if (!ex) continue;
            
            ex.setActive(true).setVisible(true);
            ex.setScale(0.6 + Math.random() * 0.7);
            ex.setTint(0xff5500);
            ex.setAlpha(1);
            
            this.physics.world.enable(ex);
            ex.body.setCircle(15); // Уменьшенный радиус
            ex.body.setAllowGravity(false);
            ex.damage = 1;
            ex.hasDamaged = false;
            
            let targetScale = 1.8 + Math.random() * 1.2;
            
            this.tweens.add({
                targets: ex,
                scale: targetScale,
                alpha: 0,
                duration: 900 + Math.random() * 300,
                ease: 'Power2',
                onComplete: () => {
                    if (ex.active) ex.destroy();
                }
            });
        }
        
        if (this.cameras && this.cameras.main) {
            this.cameras.main.shake(300, 0.015);
        }
        
        if (Phaser.Math.Distance.Between(player.x, player.y, x, y) < 100) {
            let dangerText = this.add.text(player.x, player.y - 50, 'ОПАСНО!', { 
                fontSize: '14px', 
                fill: '#ff0000', 
                fontFamily: '"Press Start 2P"',
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(0.5);
            
            this.tweens.add({
                targets: dangerText,
                alpha: 0,
                y: player.y - 80,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => dangerText.destroy()
            });
        }
    }, [], this);
}

function hitEnemy(bullet, enemy) {
    if (!bullet?.active) return;
    
    bullet.destroy();
    
    if (!enemy?.active || !enemy.enemyData || enemy.enemyData.killed) return;
    
    enemy.enemyData.health -= bullet.damage || 1;
    enemy.setTint(0xffffff);
    this.time.delayedCall(100, () => { if (enemy?.active) { enemy.setTint(enemy.enemyData.isBoss ? 
        (enemy.enemyData.phase === 2 ? 0xff0000 : 0x800080) : 
        enemyTypes[enemy.enemyData.typeIndex].color); } 
    });
    
    if (enemy.enemyData.health <= 0) {
        let points = enemy.enemyData.reward;
        if (enemy.enemyData.isBoss) {
            points = 500 + currentWave * 100;
            bossHealthBar.setVisible(false); bossHealthText.setVisible(false);
            bossActive = false; boss = null;
            
            waveActive = false;
            enemiesThisWave = 0;
            enemies.clear(true, true);
            enemyBullets.clear(true, true);
            
            let msg = this.add.text(400, 300, 'БОСС ПОБЕЖДЁН!', { fontSize: '32px', fill: '#ffaa00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
            this.tweens.add({ targets: msg, alpha: 0, y: 250, duration: 2000, ease: 'Power2', onComplete: () => msg.destroy() });
            
            this.time.delayedCall(3000, () => { startNextWave.call(this); }, [], this);
        }
        
        score += points; kills++;
        scoreText.setText('КРЕДИТЫ: ' + score);
        killsText.setText('УБИЙСТВ: ' + kills);
        if (window.updateShopDisplay) window.updateShopDisplay();
        
        enemy.enemyData.killed = true;
        enemy.setTint(0xffaa00);
        
        this.time.delayedCall(100, () => { if (enemy?.active) enemy.destroy(); });
    }
}

function explosionHitEnemy(explosion, enemy) {
    if (!enemy?.active || !enemy.enemyData || enemy.enemyData.killed) return;
    if (!explosion?.active || !explosion.body) return;
    if (explosion.damagedEnemies?.includes(enemy)) return;
    
    explosion.damagedEnemies = explosion.damagedEnemies || [];
    enemy.enemyData.health -= explosion.damage || 1;
    explosion.damagedEnemies.push(enemy);
    
    enemy.setTint(0xffffff);
    this.time.delayedCall(100, () => { if (enemy?.active) { enemy.setTint(enemy.enemyData.isBoss ? 
        (enemy.enemyData.phase === 2 ? 0xff0000 : 0x800080) : 
        enemyTypes[enemy.enemyData.typeIndex].color); } 
    });
    
    if (enemy.enemyData.health <= 0) {
        let points = enemy.enemyData.reward;
        if (enemy.enemyData.isBoss) {
            points = 500 + currentWave * 100;
            bossHealthBar.setVisible(false); bossHealthText.setVisible(false);
            bossActive = false; boss = null;
            
            waveActive = false;
            enemiesThisWave = 0;
            enemies.clear(true, true);
            enemyBullets.clear(true, true);
            
            let msg = this.add.text(400, 300, 'БОСС ПОБЕЖДЁН!', { fontSize: '32px', fill: '#ffaa00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
            this.tweens.add({ targets: msg, alpha: 0, y: 250, duration: 2000, ease: 'Power2', onComplete: () => msg.destroy() });
            
            this.time.delayedCall(3000, () => { startNextWave.call(this); }, [], this);
        }
        
        score += points; kills++;
        scoreText.setText('КРЕДИТЫ: ' + score);
        killsText.setText('УБИЙСТВ: ' + kills);
        if (window.updateShopDisplay) window.updateShopDisplay();
        
        enemy.enemyData.killed = true;
        enemy.setTint(0xffaa00);
        
        enemy.destroy();
    }
}

function playerHitByExplosion(player, explosion) {
    if (invincible || !explosion?.active || !explosion.body || explosion.hasDamaged) return;
    
    playerHealth--;
    updateHealthIcons.call(this);
    explosion.hasDamaged = true;
    player.setTint(0xff0000);
    invincible = true;
    
    this.time.delayedCall(1500, () => { invincible = false; if (player?.active) player.clearTint(); });
    if (playerHealth <= 0) gameOver.call(this, player, null);
}

function playerHit(player, enemy) {
    if (invincible) return;
    
    playerHealth--;
    updateHealthIcons.call(this);
    player.setTint(0xff0000);
    invincible = true;
    
    this.time.delayedCall(1500, () => { invincible = false; if (player?.active) player.clearTint(); });
    
    if (playerHealth <= 0) gameOver.call(this, player, enemy);
    else if (enemy?.active && (!enemy.enemyData || !enemy.enemyData.isBoss)) enemy.destroy();
}

function gameOver() {
    this.physics.pause();
    player.setTint(0xff0000);
    this.add.text(250, 280, 'ИГРА ОКОНЧЕНА', { fontSize: '32px', fill: '#ff0000', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4 });
    this.add.text(200, 340, 'ВОЛНА: ' + currentWave, { fontSize: '16px', fill: '#fff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3 });
    this.add.text(150, 380, 'F5 ЧТОБЫ НАЧАТЬ ЗАНОВО', { fontSize: '16px', fill: '#ffaa00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3 });
}