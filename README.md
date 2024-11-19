# Classic Asteroids Game

A modern recreation of the iconic 1979 Atari arcade game Asteroids, built using HTML5 Canvas and JavaScript.

## Game Description

In this classic arcade-style game, you pilot a spaceship through an asteroid field. Your mission is to destroy asteroids and avoid collisions while dealing with hostile UFOs.

## Features

### Core Gameplay
- Classic vector-style graphics
- Physics-based movement with momentum and friction
- Screen wrapping for all game objects
- Progressive difficulty with increasing levels

### Game Elements
1. **Player Ship**
   - Thrust-based movement
   - Rotation controls
   - Shooting mechanism
   - Screen wrapping

2. **Asteroids**
   - Three different sizes
   - Split into smaller pieces when shot
   - Procedurally generated shapes
   - Physics-based movement

3. **UFOs**
   - Two types: Large and Small
   - Different movement patterns
   - Shooting capabilities
   - Spawn based on score

4. **Scoring System**
   - Points for destroying asteroids and UFOs
   - High score persistence
   - Bonus points for completing levels

### Special Features
- Particle effects for explosions and thrust
- Screen shake on impacts
- Level progression system
- Sound effects and background beats
- Mutable audio

## Controls

- **Arrow Keys**: Control ship movement
  - ↑ (Up Arrow): Thrust
  - ← (Left Arrow): Rotate left
  - → (Right Arrow): Rotate right
- **Space**: Fire weapon
- **M**: Mute/Unmute sound

## Scoring

- Small Asteroid: 100 points
- Medium Asteroid: 200 points
- Large Asteroid: 300 points
- Small UFO: 1000 points
- Large UFO: 200 points
- Level Completion: 1000 points bonus

## Technical Details

### Technologies Used
- HTML5 Canvas for rendering
- Vanilla JavaScript for game logic
- Local Storage for high score persistence
- Web Audio API for sound effects

### Performance Features
- Framerate-independent physics
- Optimized collision detection
- Efficient particle system
- Smart object pooling

## Game Mechanics

### Level Progression
- Each level starts with more asteroids
- Formula: 3 + (level - 1) * 2 asteroids per level
- UFO spawn rate increases with score
- Increased challenge through asteroid density

### Collision System
- Precise collision detection
- Separate collision handling for:
  - Ship-Asteroid collisions
  - Bullet-Asteroid collisions
  - UFO-Asteroid collisions
  - Ship-UFO collisions
  - Bullet-UFO collisions

## Development

This game was developed as a modern take on the classic Asteroids, maintaining the core gameplay while adding modern features and effects.

## Future Enhancements
- Mobile/touch controls
- Power-up system
- Additional enemy types
- Difficulty settings
- Online leaderboard

## Credits
Inspired by the original 1979 Atari Asteroids arcade game.
