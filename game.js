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
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Game objects
        this.ship = new Ship(this.canvas.width / 2, this.canvas.height / 2);
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];
        
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

        // Update
        this.update(deltaTime);
        
        // Draw
        this.draw();

        // Next frame
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
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
        this.bullets = this.bullets.filter(bullet => bullet.isAlive());
        this.bullets.forEach(bullet => bullet.update(deltaTime, this.canvas.width, this.canvas.height));
        
        // Update asteroids
        this.asteroids.forEach(asteroid => asteroid.update(deltaTime, this.canvas.width, this.canvas.height));
        
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
        // Check bullet-asteroid collisions
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
                } else {
                    // Reset ship position
                    this.ship.x = this.canvas.width / 2;
                    this.ship.y = this.canvas.height / 2;
                    this.ship.velocity = { x: 0, y: 0 };
                    this.ship.angle = 0;
                }
                
                // Create explosion effect
                this.createExplosionParticles(this.ship.x, this.ship.y, '#FF0000', 30);
                this.screenShake = SCREEN_SHAKE_DURATION * 2;
                
                // Play ship explosion sound
                this.soundManager.play('shipExplode');
                
                break;
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
        this.asteroids.forEach(asteroid => asteroid.draw(this.ctx));

        // Update UI
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('livesValue').textContent = this.lives;
        document.getElementById('highScoreValue').textContent = this.highScore;
        
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

    update(deltaTime, canvasWidth, canvasHeight) {
        // Update position
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;

        // Wrap around screen
        if (this.x < 0) this.x = canvasWidth;
        if (this.x > canvasWidth) this.x = 0;
        if (this.y < 0) this.y = canvasHeight;
        if (this.y > canvasHeight) this.y = 0;

        // Update lifetime
        this.lifetime -= deltaTime;
    }

    isAlive() {
        return this.lifetime > 0;
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
