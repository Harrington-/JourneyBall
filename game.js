// Define logical game dimensions (16:9 aspect ratio)
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

// Physics constants
const GRAVITY = 0.6;
const FRICTION = 0.95;
const ACCELERATION = 0.8;
const MAX_VELOCITY_X = 12;
const JUMP_STRENGTH = 16;
const BALL_RADIUS = 20;

// Gravity direction for debugging (1 = down, -1 = up)
let gravityDirection = 1;

// Initialize PIXI Application with fixed logical size
const app = new PIXI.Application({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x2a3439,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});

// Edge colors
const EDGE_COLOR = 0x181c1f; // darker gunmetal gray

document.getElementById('gameContainer').appendChild(app.view);

// Function to resize canvas to fit window while maintaining aspect ratio
function resizeCanvas() {
    const gameContainer = document.getElementById('gameContainer');
    const containerWidth = gameContainer.clientWidth;
    const containerHeight = gameContainer.clientHeight;
    
    let displayWidth = containerWidth;
    let displayHeight = containerHeight;
    
    // Calculate dimensions to fit within container while maintaining aspect ratio
    const windowAspectRatio = containerWidth / containerHeight;
    
    if (windowAspectRatio > ASPECT_RATIO) {
        // Container is wider, fit to height
        displayHeight = containerHeight;
        displayWidth = displayHeight * ASPECT_RATIO;
    } else {
        // Container is taller, fit to width
        displayWidth = containerWidth;
        displayHeight = displayWidth / ASPECT_RATIO;
    }
    
    // Apply scaling to the canvas
    app.view.style.width = displayWidth + 'px';
    app.view.style.height = displayHeight + 'px';
}

// Initial resize
resizeCanvas();

// Make canvas responsive to window resizing
window.addEventListener('resize', () => {
    resizeCanvas();
});

// Save state when page unloads if ball is falling
window.addEventListener('beforeunload', (e) => {
    if (!ballPhysics.isGrounded) {
        // Save current state to sessionStorage
        const state = {
            x: circle.x,
            y: circle.y,
            velocityX: ballPhysics.velocityX,
            velocityY: ballPhysics.velocityY,
            seed: levelSeed
        };
        sessionStorage.setItem('journeyBallState', JSON.stringify(state));
    }
});

// Ball physics properties
const ballPhysics = {
    velocityX: 0,
    velocityY: 0,
    isGrounded: false
};

// Score tracking
let bestHeight = 0;

// Get DOM elements for score display
const currentHeightDisplay = document.getElementById('currentHeight');
const bestHeightDisplay = document.getElementById('bestHeight');

// Camera properties
const camera = {
    y: 0
};

// Create a world container that will hold everything (for camera control)
const world = new PIXI.Container();
app.stage.addChild(world);

// Create a container for the ball so we can rotate it
const circle = new PIXI.Container();
const ballShape = new PIXI.Graphics();
ballShape.beginFill(0xff0000);
ballShape.drawCircle(0, 0, BALL_RADIUS);
ballShape.endFill();
// Add a white line as a marker to show rotation
ballShape.lineStyle(3, 0xffffff);
ballShape.moveTo(0, 0);
ballShape.lineTo(0, -BALL_RADIUS);
circle.addChild(ballShape);

// Set initial position (or restore from sessionStorage if falling)
let levelSeed;
let wasRestored = false;
const savedBallState = sessionStorage.getItem('journeyBallState');
if (savedBallState) {
    const state = JSON.parse(savedBallState);
    circle.x = state.x;
    circle.y = state.y;
    ballPhysics.velocityX = state.velocityX;
    ballPhysics.velocityY = state.velocityY;
    levelSeed = state.seed;
    wasRestored = true;
    sessionStorage.removeItem('journeyBallState'); // Clear after restore
} else {
    circle.x = GAME_WIDTH / 2;
    circle.y = 1000;
    levelSeed = Math.floor(Math.random() * 1000000);
}

// Add circle to world
world.addChild(circle);

// Show "Still Falling" message if state was restored
if (wasRestored) {
    const message = new PIXI.Text('NOPE! Still Falling! HA!', {
        fontFamily: 'Arial',
        fontSize: 72,
        fontWeight: 'bold',
        fill: 0xff0000,
        stroke: 0xffffff,
        strokeThickness: 6,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 8,
        dropShadowDistance: 4
    });
    message.anchor.set(0.5);
    message.x = GAME_WIDTH / 2;
    message.y = GAME_HEIGHT / 2;
    app.stage.addChild(message); // Add to stage, not world (so it doesn't move with camera)
    
    // Fade out and remove after 2 seconds
    setTimeout(() => {
        const fadeOut = setInterval(() => {
            message.alpha -= 0.05;
            if (message.alpha <= 0) {
                clearInterval(fadeOut);
                app.stage.removeChild(message);
            }
        }, 30);
    }, 2000);
}

// Platforms array to store collision data
const platforms = [];

// CSV Level Format (line-based):
// x1,y1,x2,y2,thickness,type
// type: "platform" or "edge" or "slope"
// Example CSV for level 1:
// 0,1030,1920,1030,50,edge
// 810,900,1110,900,20,platform
// 250,750,550,750,20,platform

// Level loader function
function loadLevelFromCSV(csvData) {
    // Clear existing platforms from world (but keep the ball)
    for (let platform of platforms) {
        world.removeChild(platform.graphics);
    }
    platforms.length = 0;
    
    // Parse CSV
    const lines = csvData.trim().split('\n');
    for (let line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) continue; // Skip empty lines and comments
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 6) continue;
        
        const x1 = parseFloat(parts[0]);
        const y1 = parseFloat(parts[1]);
        const x2 = parseFloat(parts[2]);
        const y2 = parseFloat(parts[3]);
        const thickness = parseFloat(parts[4]);
        const type = parts[5];
        
        // Create platform graphics as a line segment with thickness
        const platformGraphics = new PIXI.Graphics();
        platformGraphics.lineStyle(thickness, EDGE_COLOR);
        platformGraphics.moveTo(x1, y1);
        platformGraphics.lineTo(x2, y2);
        
        world.addChild(platformGraphics);
        
        // Store platform collision data
        platforms.push({
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            thickness: thickness,
            type: type,
            graphics: platformGraphics
        });
    }
}

// Seeded random number generator (mulberry32)
function seededRandom(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Global RNG instance (will be set with seed)
let rng = Math.random;

// Function to generate random slope with increasing intensity
function generateRandomSlope(maxSlope) {
    // Random value between -1 and 1, then multiply by maxSlope
    const randomFactor = (rng() * 2 - 1);
    return Math.round(randomFactor * maxSlope);
}

// Generate default level with random slopes
function generateDefaultLevel(seed) {
    // Initialize seeded RNG
    rng = seededRandom(seed);
    let level = `# Level 1 - Random slopes with increasing intensity
# Bottom floor
0,1125,1920,1125,50,edge
# Platforms (x1,y1,x2,y2,thickness,type)
`;
    
    const centerX1 = 810;
    const centerX2 = 1110;
    const leftX1 = 250;
    const leftX2 = 550;
    const rightX1 = 1370;
    const rightX2 = 1670;
    
    let currentY = 950;
    const yStep = 75; // Vertical spacing between platforms
    const baseSlope = 6; // Starting max slope magnitude (pixels)
    const maxSlopeCap = 50; // Absolute cap for slope magnitude late game
    // Derive S-curve parameters from current loop logic (100000 / yStep)
    const totalCount = Math.floor(100000 / yStep);
    const curveMidpoint = Math.floor(totalCount * 0.4); // inflection ~40% up the climb
    const transitionSpan = Math.max(1, Math.floor(totalCount * 0.25)); // width of ramp region
    const curveSteepness = 1 / transitionSpan; // scale k so ramp width is consistent

    // S-curve (logistic) difficulty: difficulty(i) = cap * (1 / (1 + e^{-k(i-mid)}))
    // We'll scale from baseSlope upward, then clamp.
    for (let i = 0; i < 100000/yStep; i++) {
        const logistic = 1 / (1 + Math.exp(-curveSteepness * (i - curveMidpoint))); // 0..1
        const currentMaxSlope = Math.min(baseSlope + logistic * (maxSlopeCap - baseSlope), maxSlopeCap);
        
        // Determine platform pattern - alternating sides
        const side = i % 3; // 0 = center, 1 = left, 2 = right
        
        if (side === 0) {
            // Center platform (always flat)
            level += `${centerX1},${currentY},${centerX2},${currentY},20,platform\n`;
        } else if (side === 1) {
            // Left platform with random slope
            const leftSlope = generateRandomSlope(currentMaxSlope);
            const leftY1 = currentY + leftSlope;
            const leftY2 = currentY - leftSlope;
            level += `${leftX1},${leftY1},${leftX2},${leftY2},20,platform\n`;
        } else {
            // Right platform with random slope
            const rightSlope = generateRandomSlope(currentMaxSlope);
            const rightY1 = currentY - rightSlope;
            const rightY2 = currentY + rightSlope;
            level += `${rightX1},${rightY1},${rightX2},${rightY2},20,platform\n`;
        }
        
        currentY -= yStep;
    }
    
    return level;
}

// Default level (generated with seeded random slopes - seed set earlier)
const defaultLevel = generateDefaultLevel(levelSeed);

// Load the default level
loadLevelFromCSV(defaultLevel);

// Create permanent vertical walls that extend infinitely (as lines)
const WALL_HEIGHT = 100000; // Very tall walls
const leftWall = new PIXI.Graphics();
leftWall.lineStyle(BALL_RADIUS, EDGE_COLOR);
leftWall.moveTo(BALL_RADIUS/2, -WALL_HEIGHT);
leftWall.lineTo(BALL_RADIUS/2, GAME_HEIGHT + 20);
world.addChild(leftWall);

const rightWall = new PIXI.Graphics();
rightWall.lineStyle(BALL_RADIUS, EDGE_COLOR);
rightWall.moveTo(GAME_WIDTH - BALL_RADIUS/2, -WALL_HEIGHT);
rightWall.lineTo(GAME_WIDTH - BALL_RADIUS/2, GAME_HEIGHT + 20);
world.addChild(rightWall);

// Create a ceiling connecting the tops of the walls
const ceiling = new PIXI.Graphics();
ceiling.lineStyle(BALL_RADIUS, EDGE_COLOR);
ceiling.moveTo(BALL_RADIUS/2, -WALL_HEIGHT);
ceiling.lineTo(GAME_WIDTH - BALL_RADIUS/2, -WALL_HEIGHT);
world.addChild(ceiling);

// Add permanent walls to platforms array for collision
platforms.push({
    x1: BALL_RADIUS/2,
    y1: -WALL_HEIGHT,
    x2: BALL_RADIUS/2,
    y2: GAME_HEIGHT,
    thickness: BALL_RADIUS,
    type: 'edge',
    graphics: leftWall
});

platforms.push({
    x1: GAME_WIDTH - BALL_RADIUS/2,
    y1: -WALL_HEIGHT,
    x2: GAME_WIDTH - BALL_RADIUS/2,
    y2: GAME_HEIGHT,
    thickness: BALL_RADIUS,
    type: 'edge',
    graphics: rightWall
});

// Add ceiling to platforms for collision
platforms.push({
    x1: BALL_RADIUS/2,
    y1: -WALL_HEIGHT,
    x2: GAME_WIDTH - BALL_RADIUS/2,
    y2: -WALL_HEIGHT,
    thickness: BALL_RADIUS,
    type: 'edge',
    graphics: ceiling
});

// Resolve circle vs line segment collision
function resolveCircleLineCollision(circle, x1, y1, x2, y2, thickness) {
    // Vector from line start to end
    const lineX = x2 - x1;
    const lineY = y2 - y1;
    const lineLength = Math.sqrt(lineX * lineX + lineY * lineY);
    
    if (lineLength === 0) return false; // Zero-length line
    
    // Normalize line direction
    const lineDirX = lineX / lineLength;
    const lineDirY = lineY / lineLength;
    
    // Vector from line start to circle center
    const toCircleX = circle.x - x1;
    const toCircleY = circle.y - y1;
    
    // Project circle center onto line
    const projection = toCircleX * lineDirX + toCircleY * lineDirY;
    const clampedProjection = Math.max(0, Math.min(lineLength, projection));
    
    // Closest point on line segment to circle
    const closestX = x1 + lineDirX * clampedProjection;
    const closestY = y1 + lineDirY * clampedProjection;
    
    // Distance from circle to closest point
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distSq = dx * dx + dy * dy;
    const collisionRadius = BALL_RADIUS + thickness / 2;
    
    if (distSq >= collisionRadius * collisionRadius) return false; // No collision
    
    const dist = Math.sqrt(distSq) || 0.0001;
    const overlap = collisionRadius - dist;
    
    // Normal from line to circle
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Separate the ball
    circle.x += nx * overlap;
    circle.y += ny * overlap;
    
    // Only apply impulse if moving into the surface
    const relVel = ballPhysics.velocityX * nx + ballPhysics.velocityY * ny;
    if (relVel < 0) {
        // Use dynamic restitution: 0.8 when space held, 0 otherwise
        const currentRestitution = keys.space ? 0.8 : 0;
        const impulse = (1 + currentRestitution) * relVel;
        ballPhysics.velocityX -= impulse * nx;
        ballPhysics.velocityY -= impulse * ny;
    }
    
    // If normal points mostly up, treat as grounded contact
    if (ny < -0.5) {
        ballPhysics.isGrounded = true;
    }
    
    return true;
}

// Key state
const keys = {
    a: false,
    d: false,
    space: false
};

// Track if space was previously pressed to prevent multiple jumps
let spacePreviouslyPressed = false;

// Key press handlers
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a') {
        keys.a = true;
    } else if (key === 'd') {
        keys.d = true;
    } else if (key === ' ') {
        e.preventDefault();
        keys.space = true;
    } else if (key === 'u') {
        // Secret hotkey to reverse gravity
        gravityDirection *= -1;
    } else if (key === 'r') {
        // Reset game (only if grounded)
        if (ballPhysics.isGrounded) {
            sessionStorage.removeItem('journeyBallState');
            location.reload();
        }
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a') {
        keys.a = false;
    } else if (key === 'd') {
        keys.d = false;
    } else if (key === ' ') {
        e.preventDefault();
        keys.space = false;
        spacePreviouslyPressed = false;
    }
});

// Game loop
app.ticker.add(() => {
    // Apply gravity
    ballPhysics.velocityY += GRAVITY * gravityDirection;
    ballPhysics.velocityY = Math.min(Math.max(ballPhysics.velocityY, -30), 30); // Clamp vertical speed

    // Apply friction and momentum to horizontal movement (only when grounded)
    if (ballPhysics.isGrounded) {
        if (keys.a) {
            ballPhysics.velocityX = Math.max(ballPhysics.velocityX - ACCELERATION, -MAX_VELOCITY_X);
        } else if (keys.d) {
            ballPhysics.velocityX = Math.min(ballPhysics.velocityX + ACCELERATION, MAX_VELOCITY_X);
        } else {
            // Apply friction when no keys pressed
            ballPhysics.velocityX *= FRICTION;
        }
    }
    // When in air, maintain momentum (no friction or acceleration)

    // Update position with sub-stepping to prevent tunneling through objects
    const substeps = Math.max(1, Math.ceil(Math.max(Math.abs(ballPhysics.velocityX), Math.abs(ballPhysics.velocityY)) / 10));
    const stepVelX = ballPhysics.velocityX / substeps;
    const stepVelY = ballPhysics.velocityY / substeps;
    
    ballPhysics.isGrounded = false;
    
    for (let i = 0; i < substeps; i++) {
        circle.x += stepVelX;
        circle.y += stepVelY;
        
        // Check collision with all platforms (line segments) in each substep
        for (let platform of platforms) {
            resolveCircleLineCollision(circle, platform.x1, platform.y1, platform.x2, platform.y2, platform.thickness);
        }
    }

    // Rotate the ball to simulate rolling
    // The angle increment is proportional to the distance traveled divided by the radius
    // Negative sign for left, positive for right
    circle.rotation += ballPhysics.velocityX / BALL_RADIUS;

    // Simple camera: keep ball centered vertically in screen
    camera.y = circle.y - GAME_HEIGHT / 2;
    
    // Apply camera position to world
    world.y = -camera.y;

    // Update score display
    // Height is calculated as distance from starting position (inverted Y axis)
    const currentHeight = Math.max(0, Math.round(GAME_HEIGHT - circle.y));
    currentHeightDisplay.textContent = currentHeight;
    
    // Update best height
    if (currentHeight > bestHeight) {
        bestHeight = currentHeight;
        bestHeightDisplay.textContent = bestHeight;
    }

    // Handle jumping (after collision checks so isGrounded is accurate)
    if (keys.space && ballPhysics.isGrounded && !spacePreviouslyPressed) {
        ballPhysics.velocityY = -JUMP_STRENGTH;
        ballPhysics.isGrounded = false;
        spacePreviouslyPressed = true;
    }
});