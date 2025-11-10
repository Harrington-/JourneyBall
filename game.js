// Initialize PIXI Application
const app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x1099bb,
    resolution: window.devicePixelRatio || 1,
});

document.getElementById('gameContainer').appendChild(app.view);

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