// Game constants
const SHIP_SIZE = 20;
const TURN_SPEED = 360; // degrees per second
const SHIP_THRUST = 5;
const FRICTION = 0.7;
const ASTEROID_SPEED = 50;
const ASTEROID_VERTICES = 10;
const ASTEROID_JAG = 0.4;
const BULLET_SPEED = 500;
const BULLET_LIFETIME = 2; // seconds

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
                break;
            }
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw game objects
        this.ship.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.asteroids.forEach(asteroid => asteroid.draw(this.ctx));

        // Update UI
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('livesValue').textContent = this.lives;
        document.getElementById('highScoreValue').textContent = this.highScore;
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
        this.velocity.x += force * Math.cos(this.angle * Math.PI / 180);
        this.velocity.y += force * Math.sin(this.angle * Math.PI / 180);
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        // Apply friction
        this.velocity.x *= FRICTION;
        this.velocity.y *= FRICTION;

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

// Initialize game when window loads
window.onload = () => {
    new Game();
};
