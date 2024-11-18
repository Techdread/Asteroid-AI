// Game constants
const SHIP_SIZE = 20;
const TURN_SPEED = 360; // degrees per second
const SHIP_THRUST = 10; // Increased from 5 to 10
const FRICTION = 0.98; // Increased from 0.7 to 0.98 for smoother deceleration
const MAX_SPEED = 500; // Added maximum speed limit
const ASTEROID_SPEED = 50;
const ASTEROID_VERTICES = 10;
const ASTEROID_JAG = 0.4;
const BULLET_SPEED = 500;
const BULLET_LIFETIME = 2; // seconds
const PARTICLE_LIFETIME = 1; // seconds
const THRUST_PARTICLE_SPEED = 100;
const EXPLOSION_PARTICLE_SPEED = 200;
const SCREEN_SHAKE_DURATION = 0.2;
const UFO_LARGE_SIZE = 30;
const UFO_SMALL_SIZE = 20;
const UFO_LARGE_SPEED = 100;
const UFO_SMALL_SPEED = 150;
const UFO_SPAWN_INTERVAL = 10; // seconds
const UFO_SHOOT_INTERVAL = 1; // seconds

class SoundManager {
    constructor() {
        this.sounds = {};
        this.isMuted = false;
        this.thrustSound = null;
        this.beatTimer = 0;
        this.beatInterval = 0.5; // seconds between beats
        this.currentBeat = 1;
        
        // Load all sounds
        this.loadSound('thrust', 'sounds/thrust.wav');
        this.loadSound('fire', 'sounds/fire.wav');
        this.loadSound('bangLarge', 'sounds/bangLarge.wav');
        this.loadSound('bangMedium', 'sounds/bangMedium.wav');
        this.loadSound('bangSmall', 'sounds/bangSmall.wav');
        this.loadSound('shipExplode', 'sounds/shipExplode.wav');
        this.loadSound('beat1', 'sounds/beat1.wav');
        this.loadSound('beat2', 'sounds/beat2.wav');
        this.loadSound('ufoLarge', 'sounds/ufoLarge.wav');
        this.loadSound('ufoSmall', 'sounds/ufoSmall.wav');
        this.loadSound('ufoShoot', 'sounds/ufoShoot.wav');

        // Add mute control
        window.addEventListener('keydown', (e) => {
            if (e.key === 'm') {
                this.toggleMute();
            }
        });
    }

    loadSound(name, path) {
        const audio = new Audio(path);
        audio.preload = 'auto';
        this.sounds[name] = audio;
    }

    play(name, volume = 1.0) {
        if (this.isMuted) return;
        
        const sound = this.sounds[name];
        if (sound) {
            // Create a clone for overlapping sounds
            const clone = sound.cloneNode();
            clone.volume = volume;
            clone.play().catch(e => console.log('Sound play failed:', e));
        }
    }

    startThrust() {
        if (this.isMuted) return;
        
        if (!this.thrustSound) {
            this.thrustSound = this.sounds['thrust'].cloneNode();
            this.thrustSound.loop = true;
            this.thrustSound.volume = 0.5;
            this.thrustSound.play().catch(e => console.log('Thrust sound failed:', e));
        }
    }

    stopThrust() {
        if (this.thrustSound) {
            this.thrustSound.pause();
            this.thrustSound = null;
        }
    }

    updateBackgroundBeat(deltaTime) {
        this.beatTimer += deltaTime;
        if (this.beatTimer >= this.beatInterval) {
            this.beatTimer = 0;
            this.play(`beat${this.currentBeat}`, 0.3);
            this.currentBeat = this.currentBeat === 1 ? 2 : 1;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopThrust();
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.lives = 3;
        this.highScore = localStorage.getItem('asteroidHighScore') || 0;
        this.isGameOver = false;
        this.level = 1;
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Game objects
        this.ship = new Ship(this.canvas.width / 2, this.canvas.height / 2);
        this.asteroids = [];
        this.bullets = [];  // Ship bullets
        this.ufoBullets = []; // UFO bullets
        this.ufos = [];
        this.particles = []; // Re-add particles array
        this.ufoSpawnTimer = UFO_SPAWN_INTERVAL;
        
        // Add shooting cooldown
        this.shootCooldown = 0;
        this.SHOOT_DELAY = 0.25; // seconds between shots
        
        // Input handling
        this.keys = {};
        this.setupInputHandlers();
        
        // Start game loop
        this.lastTime = 0;
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
        
        // Spawn initial asteroids
        this.spawnAsteroids(5);
        
        // Screen shake
        this.screenShake = 0;
        
        // Initialize sound manager
        this.soundManager = new SoundManager();
        
        // Add event listener for play again button
        document.getElementById('restartButton').addEventListener('click', () => {
            document.getElementById('gameOver').classList.add('hidden');
            this.resetGame();
            // Resume game loop
            this.isGameOver = false;
            requestAnimationFrame(this.gameLoop.bind(this));
        });
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth - 40;
        this.canvas.height = window.innerHeight - 40;
    }

    setupInputHandlers() {
        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }

    gameLoop(timestamp) {
        // Calculate delta time
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        // Update game state
        if (!this.isGameOver) {
            this.update(deltaTime);
            this.draw();
            requestAnimationFrame(this.gameLoop.bind(this));
        }
    }

    update(deltaTime) {
        // Update shoot cooldown
        this.shootCooldown = Math.max(0, this.shootCooldown - deltaTime);

        // Update ship
        if (this.keys['ArrowLeft']) this.ship.rotate(-TURN_SPEED * deltaTime);
        if (this.keys['ArrowRight']) this.ship.rotate(TURN_SPEED * deltaTime);
        if (this.keys['ArrowUp']) this.ship.thrust(SHIP_THRUST);
        if (this.keys[' '] && this.shootCooldown === 0) {
            this.shoot();
            this.shootCooldown = this.SHOOT_DELAY;
        }
        
        this.ship.update(deltaTime, this.canvas.width, this.canvas.height);
        
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update(deltaTime);
            if (!this.bullets[i].isVisible(this.canvas.width, this.canvas.height)) {
                this.bullets.splice(i, 1);
            }
        }

        // Update UFO bullets
        for (let i = this.ufoBullets.length - 1; i >= 0; i--) {
            this.ufoBullets[i].update(deltaTime);
            if (!this.ufoBullets[i].isVisible(this.canvas.width, this.canvas.height)) {
                this.ufoBullets.splice(i, 1);
            }
        }
        
        // Update asteroids
        this.asteroids.forEach(asteroid => asteroid.update(deltaTime, this.canvas.width, this.canvas.height));
        
        // Update UFOs
        this.updateUFOs(deltaTime);
        
        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake -= deltaTime;
        }

        // Update particles
        this.particles = this.particles.filter(particle => particle.isAlive());
        this.particles.forEach(particle => particle.update(deltaTime, this.canvas.width, this.canvas.height));

        // Add thrust particles
        if (this.keys['ArrowUp']) {
            this.createThrustParticles();
        }
        
        // Update thrust sound
        if (this.keys['ArrowUp']) {
            this.soundManager.startThrust();
        } else {
            this.soundManager.stopThrust();
        }

        // Update background beat
        this.soundManager.updateBackgroundBeat(deltaTime);
        
        // Check for collisions
        this.checkCollisions();
        
        // Check if level is complete (no asteroids left)
        if (this.asteroids.length === 0) {
            this.nextLevel();
        }
    }

    shoot() {
        const bullet = new Bullet(
            this.ship.x + Math.cos(this.ship.angle * Math.PI / 180) * SHIP_SIZE,
            this.ship.y + Math.sin(this.ship.angle * Math.PI / 180) * SHIP_SIZE,
            this.ship.angle
        );
        this.bullets.push(bullet);
        this.soundManager.play('fire');
    }

    spawnAsteroids(count) {
        for (let i = 0; i < count; i++) {
            let x, y;
            do {
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
            } while (this.distanceBetweenPoints(x, y, this.ship.x, this.ship.y) < 200);
            
            this.asteroids.push(new Asteroid(x, y));
        }
    }

    distanceBetweenPoints(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    checkCollisions() {
        // Check ship bullets against asteroids
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const bullet = this.bullets[i];
                const asteroid = this.asteroids[j];
                
                const distance = this.distanceBetweenPoints(
                    bullet.x, bullet.y,
                    asteroid.x, asteroid.y
                );
                
                if (distance < asteroid.radius) {
                    // Remove bullet
                    this.bullets.splice(i, 1);
                    
                    // Split asteroid
                    if (asteroid.size > 1) {
                        for (let k = 0; k < 2; k++) {
                            this.asteroids.push(new Asteroid(
                                asteroid.x,
                                asteroid.y,
                                asteroid.size - 1
                            ));
                        }
                    }
                    
                    // Remove asteroid
                    this.asteroids.splice(j, 1);
                    
                    // Update score
                    this.score += (4 - asteroid.size) * 100;
                    if (this.score > this.highScore) {
                        this.highScore = this.score;
                        localStorage.setItem('asteroidHighScore', this.highScore);
                    }
                    
                    // Create explosion effect
                    this.createExplosionParticles(asteroid.x, asteroid.y);
                    this.screenShake = SCREEN_SHAKE_DURATION;
                    
                    // Play explosion sound based on asteroid size
                    this.soundManager.play(
                        asteroid.size === 3 ? 'bangLarge' :
                        asteroid.size === 2 ? 'bangMedium' : 'bangSmall'
                    );
                    
                    break;
                }
            }
        }

        // Check ship bullets against UFOs
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.ufos.length - 1; j >= 0; j--) {
                const bullet = this.bullets[i];
                const ufo = this.ufos[j];
                
                // Skip if UFO hasn't entered screen yet
                if (!ufo.hasEnteredScreen) continue;
                
                const ufoBounds = ufo.getCollisionBounds();
                const distance = this.distanceBetweenPoints(
                    bullet.x, bullet.y,
                    ufoBounds.x, ufoBounds.y
                );
                
                if (distance < ufoBounds.radius) {
                    // Remove bullet and UFO
                    this.bullets.splice(i, 1);
                    this.ufos.splice(j, 1);
                    
                    // Update score
                    this.score += ufo.isSmall ? 1000 : 200;
                    
                    // Create explosion effect
                    this.createExplosionParticles(ufo.x, ufo.y, '#FF00FF', 20);
                    this.screenShake = SCREEN_SHAKE_DURATION;
                    
                    break;
                }
            }
        }

        // Check UFO bullets against ship
        for (let i = this.ufoBullets.length - 1; i >= 0; i--) {
            const bullet = this.ufoBullets[i];
            const distance = this.distanceBetweenPoints(
                bullet.x, bullet.y,
                this.ship.x, this.ship.y
            );
            
            if (distance < SHIP_SIZE / 2) {
                // Remove bullet
                this.ufoBullets.splice(i, 1);
                
                this.lives--;
                if (this.lives <= 0) {
                    document.getElementById('gameOver').classList.remove('hidden');
                    document.getElementById('finalScore').textContent = this.score;
                    this.isGameOver = true;
                } else {
                    // Reset ship position
                    this.ship.x = this.canvas.width / 2;
                    this.ship.y = this.canvas.height / 2;
                    this.ship.velocity = { x: 0, y: 0 };
                    this.ship.angle = 0;
                }
                
                // Create explosion effects
                this.createExplosionParticles(this.ship.x, this.ship.y, '#FF0000', 30);
                this.screenShake = SCREEN_SHAKE_DURATION;
                
                // Play ship explosion sound
                this.soundManager.play('shipExplode');
                
                break;
            }
        }

        // Check ship-asteroid collisions
        for (const asteroid of this.asteroids) {
            const distance = this.distanceBetweenPoints(
                this.ship.x, this.ship.y,
                asteroid.x, asteroid.y
            );
            
            if (distance < asteroid.radius + SHIP_SIZE / 2) {
                this.lives--;
                if (this.lives <= 0) {
                    document.getElementById('gameOver').classList.remove('hidden');
                    document.getElementById('finalScore').textContent = this.score;
                    this.isGameOver = true;
                } else {
                    // Reset ship position
                    this.ship.x = this.canvas.width / 2;
                    this.ship.y = this.canvas.height / 2;
                    this.ship.velocity = { x: 0, y: 0 };
                    this.ship.angle = 0;
                }
                
                // Create explosion effects
                this.createExplosionParticles(this.ship.x, this.ship.y, '#FF0000', 30);
                this.createExplosionParticles(asteroid.x, asteroid.y);
                this.screenShake = SCREEN_SHAKE_DURATION * 2;
                
                // Remove asteroid
                this.asteroids = this.asteroids.filter(a => a !== asteroid);
                
                // Play ship explosion sound
                this.soundManager.play('shipExplode');
                
                break;
            }
        }

        // Check ship-UFO collisions
        for (const ufo of this.ufos) {
            // Skip if UFO hasn't entered screen yet
            if (!ufo.hasEnteredScreen) continue;

            const ufoBounds = ufo.getCollisionBounds();
            const distance = this.distanceBetweenPoints(
                this.ship.x, this.ship.y,
                ufoBounds.x, ufoBounds.y
            );
            
            if (distance < ufoBounds.radius + SHIP_SIZE / 2) {
                this.lives--;
                if (this.lives <= 0) {
                    document.getElementById('gameOver').classList.remove('hidden');
                    document.getElementById('finalScore').textContent = this.score;
                    this.isGameOver = true;
                } else {
                    // Reset ship position
                    this.ship.x = this.canvas.width / 2;
                    this.ship.y = this.canvas.height / 2;
                    this.ship.velocity = { x: 0, y: 0 };
                    this.ship.angle = 0;
                }
                
                // Create explosion effects
                this.createExplosionParticles(this.ship.x, this.ship.y, '#FF0000', 30);
                this.createExplosionParticles(ufo.x, ufo.y, '#FF00FF', 20);
                this.screenShake = SCREEN_SHAKE_DURATION * 2;
                
                // Remove UFO
                this.ufos = this.ufos.filter(u => u !== ufo);
                break;
            }
        }

        // Check UFO-asteroid collisions
        for (let i = this.ufos.length - 1; i >= 0; i--) {
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const ufo = this.ufos[i];
                const asteroid = this.asteroids[j];
                
                // Skip if UFO hasn't entered screen yet
                if (!ufo.hasEnteredScreen) continue;
                
                const ufoBounds = ufo.getCollisionBounds();
                const distance = this.distanceBetweenPoints(
                    ufoBounds.x, ufoBounds.y,
                    asteroid.x, asteroid.y
                );
                
                if (distance < ufoBounds.radius + asteroid.radius) {
                    // Remove UFO
                    this.ufos.splice(i, 1);
                    
                    // Split asteroid
                    if (asteroid.size > 1) {
                        for (let k = 0; k < 2; k++) {
                            this.asteroids.push(new Asteroid(
                                asteroid.x,
                                asteroid.y,
                                asteroid.size - 1
                            ));
                        }
                    }
                    
                    // Remove asteroid
                    this.asteroids.splice(j, 1);
                    
                    // Update score (half points for UFO collision)
                    this.score += Math.floor((4 - asteroid.size) * 50);
                    if (this.score > this.highScore) {
                        this.highScore = this.score;
                        localStorage.setItem('asteroidHighScore', this.highScore);
                    }
                    
                    // Create explosion effects
                    this.createExplosionParticles(asteroid.x, asteroid.y);
                    this.createExplosionParticles(ufo.x, ufo.y, '#FF00FF', 20);
                    this.screenShake = SCREEN_SHAKE_DURATION;
                    
                    // Play explosion sounds
                    this.soundManager.play(
                        asteroid.size === 3 ? 'bangLarge' :
                        asteroid.size === 2 ? 'bangMedium' : 'bangSmall'
                    );
                    
                    break;
                }
            }
        }
    }

    createThrustParticles() {
        const angle = (this.ship.angle + 180) * Math.PI / 180; // Opposite to ship direction
        const spread = Math.PI / 4; // 45-degree spread

        for (let i = 0; i < 2; i++) {
            const particleAngle = angle + (Math.random() - 0.5) * spread;
            const speed = THRUST_PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
            
            this.particles.push(new Particle(
                this.ship.x - Math.cos(this.ship.angle * Math.PI / 180) * SHIP_SIZE / 2,
                this.ship.y - Math.sin(this.ship.angle * Math.PI / 180) * SHIP_SIZE / 2,
                {
                    x: Math.cos(particleAngle) * speed,
                    y: Math.sin(particleAngle) * speed
                },
                0.5, // lifetime
                '#FFA500', // orange color
                1 // size
            ));
        }
    }

    createExplosionParticles(x, y, color = 'white', count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = EXPLOSION_PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
            
            this.particles.push(new Particle(
                x,
                y,
                {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                },
                0.75, // lifetime
                color,
                2 // size
            ));
        }
    }

    updateUFOs(deltaTime) {
        // Update UFO spawn timer
        this.ufoSpawnTimer -= deltaTime;
        if (this.ufoSpawnTimer <= 0) {
            this.ufoSpawnTimer = UFO_SPAWN_INTERVAL;
            // 30% chance for small UFO, increases with score
            const smallUfoChance = Math.min(0.3 + this.score / 10000, 0.7);
            const isSmall = Math.random() < smallUfoChance;
            this.ufos.push(new UFO(this.canvas.width, this.canvas.height, isSmall));
        }

        // Update existing UFOs
        for (let i = this.ufos.length - 1; i >= 0; i--) {
            const ufo = this.ufos[i];
            const bullet = ufo.update(deltaTime, this.canvas.width, this.canvas.height, this.ship.x, this.ship.y);
            
            // Add UFO bullet if shot
            if (bullet) {
                this.ufoBullets.push(bullet);
                this.soundManager.play('ufoShoot', 0.5);
            }
            
            // Remove UFO if off screen
            if (!ufo.isVisible(this.canvas.width)) {
                this.ufos.splice(i, 1);
            }
        }
    }

    nextLevel() {
        // Increment level
        this.level++;
        
        // Create asteroids for new level (initial 3 + 2 per level)
        const numAsteroids = 3 + (this.level - 1) * 2;
        for (let i = 0; i < numAsteroids; i++) {
            this.createAsteroid();
        }
        
        // Reset ship position
        this.ship.x = this.canvas.width / 2;
        this.ship.y = this.canvas.height / 2;
        this.ship.velocity = { x: 0, y: 0 };
        this.ship.angle = 0;
        
        // Add bonus points for completing level
        this.score += 1000;
        
        // Create level complete effect
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const speed = 200;
            this.particles.push(new Particle(
                this.ship.x,
                this.ship.y,
                {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                },
                2,
                '#00FF00',
                4
            ));
        }
        
        // Add screen shake effect
        this.screenShake = SCREEN_SHAKE_DURATION;
        
        // Play level complete sound
        this.soundManager.play('bangLarge', 0.7);
    }

    resetGame() {
        // Reset game objects
        this.ship = new Ship(this.canvas.width / 2, this.canvas.height / 2);
        this.asteroids = [];
        this.bullets = [];
        this.ufoBullets = [];
        this.ufos = [];
        this.particles = [];
        
        // Reset game state
        this.lives = 3;
        this.score = 0;
        this.level = 1;
        this.screenShake = 0;
        this.ufoSpawnTimer = UFO_SPAWN_INTERVAL;
        this.shootCooldown = 0;
        this.lastTime = performance.now();
        
        // Create initial asteroids
        const numAsteroids = 3;
        for (let i = 0; i < numAsteroids; i++) {
            this.createAsteroid();
        }
    }

    createAsteroid() {
        let x, y;
        do {
            x = Math.random() * this.canvas.width;
            y = Math.random() * this.canvas.height;
        } while (this.distanceBetweenPoints(x, y, this.ship.x, this.ship.y) < 100);
        
        this.asteroids.push(new Asteroid(x, y, 3));
    }

    draw() {
        // Apply screen shake
        this.ctx.save();
        if (this.screenShake > 0) {
            const magnitude = 10 * (this.screenShake / SCREEN_SHAKE_DURATION);
            this.ctx.translate(
                Math.random() * magnitude - magnitude / 2,
                Math.random() * magnitude - magnitude / 2
            );
        }

        // Clear canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw game objects
        this.particles.forEach(particle => particle.draw(this.ctx));
        this.ship.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.ufoBullets.forEach(bullet => bullet.draw(this.ctx));
        this.asteroids.forEach(asteroid => asteroid.draw(this.ctx));
        this.ufos.forEach(ufo => ufo.draw(this.ctx));

        // Update UI
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('livesValue').textContent = this.lives;
        document.getElementById('highScoreValue').textContent = this.highScore;
        
        // Draw level (moved to right side of screen)
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        const levelText = `Level: ${this.level}`;
        const levelMetrics = this.ctx.measureText(levelText);
        this.ctx.fillText(levelText, this.canvas.width - levelMetrics.width - 20, 30);
        
        this.ctx.restore();
    }
}

class Ship {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.velocity = { x: 0, y: 0 };
        this.thrusting = false;
    }

    rotate(angle) {
        this.angle += angle;
    }

    thrust(force) {
        const thrustX = force * Math.cos(this.angle * Math.PI / 180);
        const thrustY = force * Math.sin(this.angle * Math.PI / 180);
        
        // Apply thrust
        this.velocity.x += thrustX;
        this.velocity.y += thrustY;
        
        // Limit maximum speed
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > MAX_SPEED) {
            const ratio = MAX_SPEED / speed;
            this.velocity.x *= ratio;
            this.velocity.y *= ratio;
        }
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        // Apply friction with deltaTime scaling
        this.velocity.x *= Math.pow(FRICTION, deltaTime * 60); // Scale friction with framerate
        this.velocity.y *= Math.pow(FRICTION, deltaTime * 60);

        // Update position with deltaTime scaling
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;

        // Wrap around screen
        if (this.x < 0) this.x = canvasWidth;
        if (this.x > canvasWidth) this.x = 0;
        if (this.y < 0) this.y = canvasHeight;
        if (this.y > canvasHeight) this.y = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * Math.PI / 180);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(SHIP_SIZE, 0);
        ctx.lineTo(-SHIP_SIZE / 2, SHIP_SIZE / 2);
        ctx.lineTo(-SHIP_SIZE / 2, -SHIP_SIZE / 2);
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    }
}

class Asteroid {
    constructor(x, y, size = 3) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = size * 20;
        
        // Random velocity
        const speed = ASTEROID_SPEED * (4 - size) / 3;
        const angle = Math.random() * Math.PI * 2;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        // Generate vertices for asteroid shape
        this.vertices = [];
        for (let i = 0; i < ASTEROID_VERTICES; i++) {
            const angle = (i * Math.PI * 2) / ASTEROID_VERTICES;
            const jag = 1 - Math.random() * ASTEROID_JAG;
            this.vertices.push({
                x: Math.cos(angle) * this.radius * jag,
                y: Math.sin(angle) * this.radius * jag
            });
        }
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        // Update position
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;
        
        // Wrap around screen
        if (this.x < 0) this.x = canvasWidth;
        if (this.x > canvasWidth) this.x = 0;
        if (this.y < 0) this.y = canvasHeight;
        if (this.y > canvasHeight) this.y = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.velocity = {
            x: Math.cos(angle * Math.PI / 180) * BULLET_SPEED,
            y: Math.sin(angle * Math.PI / 180) * BULLET_SPEED
        };
        this.lifetime = BULLET_LIFETIME;
    }

    update(deltaTime) {
        // Update position
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;

        // Update lifetime
        this.lifetime -= deltaTime;
    }

    isAlive() {
        return this.lifetime > 0;
    }

    isVisible(canvasWidth, canvasHeight) {
        return this.x >= 0 && this.x <= canvasWidth && this.y >= 0 && this.y <= canvasHeight;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class UFO {
    constructor(canvasWidth, canvasHeight, isSmall = false) {
        this.isSmall = isSmall;
        this.size = isSmall ? UFO_SMALL_SIZE : UFO_LARGE_SIZE;
        this.speed = isSmall ? UFO_SMALL_SPEED : UFO_LARGE_SPEED;
        
        // Spawn just outside the screen
        const spawnLeft = Math.random() < 0.5;
        this.x = spawnLeft ? -this.size : canvasWidth + this.size;
        this.y = Math.random() * (canvasHeight - this.size * 2) + this.size;
        
        // Move in opposite direction of spawn
        this.direction = spawnLeft ? 1 : -1;
        this.velocity = {
            x: this.direction * this.speed,
            y: Math.sin(Date.now() / 1000) * this.speed * 0.5
        };
        
        this.shootTimer = 0;
        this.collisionRadius = this.size / 2;
        this.hasEnteredScreen = false;
    }

    getCollisionBounds() {
        return {
            x: this.x,
            y: this.y,
            radius: this.collisionRadius
        };
    }

    update(deltaTime, canvasWidth, canvasHeight, shipX, shipY) {
        // Update position
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;
        
        // Check if UFO has entered the screen
        if (!this.hasEnteredScreen) {
            if ((this.direction > 0 && this.x >= 0) || 
                (this.direction < 0 && this.x <= canvasWidth)) {
                this.hasEnteredScreen = true;
            }
        }
        
        // Update vertical movement with smoother oscillation
        this.velocity.y = Math.sin(Date.now() / 1000) * this.speed * 0.3;
        
        // Wrap around screen vertically only
        if (this.y < -this.size) this.y = canvasHeight + this.size;
        if (this.y > canvasHeight + this.size) this.y = -this.size;
        
        // Update shoot timer
        this.shootTimer -= deltaTime;
        
        // Check if should shoot
        if (this.shootTimer <= 0) {
            this.shootTimer = UFO_SHOOT_INTERVAL;
            return this.shoot(shipX, shipY);
        }
        
        return null;
    }

    shoot(shipX, shipY) {
        let angle;
        if (this.isSmall) {
            // Targeted shooting for small UFO
            angle = Math.atan2(shipY - this.y, shipX - this.x) * 180 / Math.PI;
            // Add slight inaccuracy
            angle += (Math.random() - 0.5) * 20;
        } else {
            // Random shooting for large UFO
            angle = Math.random() * 360;
        }
        
        return new Bullet(this.x, this.y, angle);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw UFO body
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        // Draw dome
        ctx.beginPath();
        ctx.ellipse(0, -this.size/4, this.size/2, this.size/4, 0, Math.PI, 0);
        ctx.stroke();
        
        // Draw body
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size/3, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }

    isVisible(canvasWidth) {
        // If UFO hasn't entered screen yet, always return true
        if (!this.hasEnteredScreen) return true;
        
        // Once entered, check if it's left the screen on the opposite side
        if (this.direction > 0) {
            return this.x <= canvasWidth + this.size;
        } else {
            return this.x >= -this.size;
        }
    }
}

class Particle {
    constructor(x, y, velocity, lifetime = PARTICLE_LIFETIME, color = 'white', size = 2) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.lifetime = lifetime;
        this.originalLifetime = lifetime;
        this.color = color;
        this.size = size;
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;
        this.lifetime -= deltaTime;

        // Wrap around screen
        if (this.x < 0) this.x = canvasWidth;
        if (this.x > canvasWidth) this.x = 0;
        if (this.y < 0) this.y = canvasHeight;
        if (this.y > canvasHeight) this.y = 0;
    }

    draw(ctx) {
        const alpha = this.lifetime / this.originalLifetime;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isAlive() {
        return this.lifetime > 0;
    }
}

// Initialize game when window loads
window.onload = () => {
    new Game();
};
