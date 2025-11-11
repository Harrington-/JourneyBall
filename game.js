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
const RESTITUTION = 0.3; // bounce factor (0 = no bounce, 1 = perfect elastic)

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

// Ball physics properties
const ballPhysics = {
    velocityX: 0,
    velocityY: 0,
    isJumping: false,
    isGrounded: false,
    groundY: GAME_HEIGHT - BALL_RADIUS - 50 // Platform at bottom
};

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

// Set initial position
circle.x = GAME_WIDTH / 2;
circle.y = GAME_HEIGHT / 2;

// Add circle to stage
app.stage.addChild(circle);

// Platforms array to store collision data
const platforms = [];

// CSV Level Format:
// x,y,width,height,type
// type: "platform" or "edge"
// Example CSV for level 1:
// 0,1030,1920,50,edge
// 960,900,300,20,platform
// 400,750,300,20,platform
// 1520,750,300,20,platform
// 960,600,300,20,platform

// Level loader function
function loadLevelFromCSV(csvData) {
    // Clear existing platforms from stage (but keep the ball)
    for (let platform of platforms) {
        app.stage.removeChild(platform.graphics);
    }
    platforms.length = 0;
    
    // Parse CSV
    const lines = csvData.trim().split('\n');
    for (let line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) continue; // Skip empty lines and comments
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 5) continue;
        
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const width = parseFloat(parts[2]);
        const height = parseFloat(parts[3]);
        const type = parts[4];
        
        // Create platform graphics
        const platformGraphics = new PIXI.Graphics();
        platformGraphics.beginFill(EDGE_COLOR);
        platformGraphics.drawRect(x, y, width, height);
        platformGraphics.endFill();
        
        app.stage.addChild(platformGraphics);
        
        // Store platform collision data
        platforms.push({
            x: x,
            y: y,
            width: width,
            height: height,
            type: type,
            graphics: platformGraphics
        });
    }
}

// Default level (perimeter platforms)
const defaultLevel = `# Level 1 - Perimeter
0,1030,1920,50,edge
0,0,1920,20,edge
0,0,20,1080,edge
1900,0,20,1080,edge
# Platforms
810,900,300,20,platform
250,750,300,20,platform
1370,750,300,20,platform
810,600,300,20,platform
250,450,300,20,platform
1370,450,300,20,platform
810,300,300,20,platform`;

// Load the default level
loadLevelFromCSV(defaultLevel);

// Resolve circle vs axis-aligned rect collision, push circle out and reflect velocity
function resolveCircleRectCollision(circle, px, py, pw, ph) {
    // nearest point on rect to circle center
    const nearestX = Math.max(px, Math.min(circle.x, px + pw));
    const nearestY = Math.max(py, Math.min(circle.y, py + ph));
    let dx = circle.x - nearestX;
    let dy = circle.y - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq > BALL_RADIUS * BALL_RADIUS) return false;

    const dist = Math.sqrt(distSq) || 0.0001;
    const overlap = BALL_RADIUS - dist;

    // normal from rect -> circle
    const nx = dx / dist;
    const ny = dy / dist;

    // separate the ball so it no longer intersects
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

    // if normal points mostly up, treat as grounded contact
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
    ballPhysics.velocityY += GRAVITY;

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
        
        // Check collision with all platforms in each substep
        for (let platform of platforms) {
            resolveCircleRectCollision(circle, platform.x, platform.y, platform.width, platform.height);
        }
    }

    // Rotate the ball to simulate rolling
    // The angle increment is proportional to the distance traveled divided by the radius
    // Negative sign for left, positive for right
    circle.rotation += ballPhysics.velocityX / BALL_RADIUS;

    // Handle jumping (after collision checks so isGrounded is accurate)
    if (keys.space && ballPhysics.isGrounded && !spacePreviouslyPressed) {
        ballPhysics.velocityY = -JUMP_STRENGTH;
        ballPhysics.isGrounded = false;
        spacePreviouslyPressed = true;
    }
});