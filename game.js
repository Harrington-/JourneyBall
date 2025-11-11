// Define logical game dimensions (16:9 aspect ratio)
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

// Initialize PIXI Application with fixed logical size
const app = new PIXI.Application({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x1099bb,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});

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

// Create a circle
const circle = new PIXI.Graphics();
circle.beginFill(0xff0000);
circle.drawCircle(0, 0, 20);
circle.endFill();

// Set initial position
circle.x = app.screen.width / 2;
circle.y = app.screen.height / 2;

// Add circle to stage
app.stage.addChild(circle);

// Movement speed
const speed = 5;

// Key state
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Key press handlers
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = false;
    }
});

// Game loop
app.ticker.add(() => {
    // Update position based on key state
    if (keys.w && circle.y > 20) circle.y -= speed;
    if (keys.s && circle.y < app.screen.height - 20) circle.y += speed;
    if (keys.a && circle.x > 20) circle.x -= speed;
    if (keys.d && circle.x < app.screen.width - 20) circle.x += speed;
});