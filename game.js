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

// Create the perimeter platforms
const floorLimitBox = new PIXI.Graphics();
floorLimitBox.beginFill(EDGE_COLOR);
floorLimitBox.drawRect(0, ballPhysics.groundY + BALL_RADIUS, GAME_WIDTH, 50);
floorLimitBox.endFill();

const ceilingLimitBox = new PIXI.Graphics();
ceilingLimitBox.beginFill(EDGE_COLOR);
ceilingLimitBox.drawRect(0, 0, GAME_WIDTH, BALL_RADIUS);
ceilingLimitBox.endFill();

const leftLimitBox = new PIXI.Graphics();
leftLimitBox.beginFill(EDGE_COLOR);
leftLimitBox.drawRect(0, 0, BALL_RADIUS, GAME_HEIGHT);
leftLimitBox.endFill();

const rightLimitBox = new PIXI.Graphics();
rightLimitBox.beginFill(EDGE_COLOR);
rightLimitBox.drawRect(GAME_WIDTH - BALL_RADIUS, 0, BALL_RADIUS, GAME_HEIGHT);
rightLimitBox.endFill();

// Add floor to stage
app.stage.addChild(floorLimitBox);
app.stage.addChild(ceilingLimitBox);
app.stage.addChild(leftLimitBox);
app.stage.addChild(rightLimitBox);

// Key state
const keys = {
    a: false,
    d: false,
    space: false,
    f: false
};

// Track if space was previously pressed to prevent multiple jumps
let spacePreviouslyPressed = false;
let fPreviouslyPressed = false;

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
    } else if (key === 'f') {
        keys.f = true;
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
    } else if (key === 'f') {
        keys.f = false;
        fPreviouslyPressed = false;
    }
});

// Game loop
app.ticker.add(() => {
    // Handle gravity reversal (debugging)
    if (keys.f && !fPreviouslyPressed) {
        gravityDirection *= -1;
        fPreviouslyPressed = true;
    }

    // Apply gravity with direction
    ballPhysics.velocityY += GRAVITY * gravityDirection;

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

    // Update position
    circle.x += ballPhysics.velocityX;
    circle.y += ballPhysics.velocityY;

    // Rotate the ball to simulate rolling
    // The angle increment is proportional to the distance traveled divided by the radius
    // Negative sign for left, positive for right
    circle.rotation += ballPhysics.velocityX / BALL_RADIUS;

    // Handle collisions and update isGrounded based on actual contact
    ballPhysics.isGrounded = false;

    // Handle ground collision
    if (circle.y >= ballPhysics.groundY) {
        circle.y = ballPhysics.groundY;
        ballPhysics.velocityY = 0;
        ballPhysics.isGrounded = true;
    }

    // Handle ceiling collision
    if (circle.y <= BALL_RADIUS * 2) {
        circle.y = BALL_RADIUS * 2;
        ballPhysics.velocityY = 0;
    }

    // Handle left wall collision
    if (circle.x <= BALL_RADIUS * 2) {
        circle.x = BALL_RADIUS * 2;
        ballPhysics.velocityX = Math.abs(ballPhysics.velocityX) * 0.5; // Bounce
    }

    // Handle right wall collision
    if (circle.x >= GAME_WIDTH - BALL_RADIUS * 2) {
        circle.x = GAME_WIDTH - BALL_RADIUS * 2;
        ballPhysics.velocityX = -Math.abs(ballPhysics.velocityX) * 0.5; // Bounce
    }

    // Handle jumping (after collision checks so isGrounded is accurate)
    if (keys.space && ballPhysics.isGrounded && !spacePreviouslyPressed) {
        ballPhysics.velocityY = -JUMP_STRENGTH;
        ballPhysics.isGrounded = false;
        spacePreviouslyPressed = true;
    }
});