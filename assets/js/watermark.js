const WATERMARK_TEXT = 'wechat@ shiroi333';
const SPEED = 120;
const EDGE_PADDING = 10;

const existingWatermark = document.querySelector('.site-watermark');
if (existingWatermark) {
    existingWatermark.remove();
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const watermark = document.createElement('div');
watermark.className = 'site-watermark is-visible';
watermark.textContent = WATERMARK_TEXT;
watermark.setAttribute('aria-hidden', 'true');
document.body.append(watermark);

let x = EDGE_PADDING;
let y = EDGE_PADDING;
let dx = Math.random() < 0.5 ? -1 : 1;
let dy = Math.random() < 0.5 ? -1 : 1;
let lastTime = performance.now();
let animationFrame = 0;

function getBounds() {
    return {
        maxX: Math.max(EDGE_PADDING, window.innerWidth - watermark.offsetWidth - EDGE_PADDING),
        maxY: Math.max(EDGE_PADDING, window.innerHeight - watermark.offsetHeight - EDGE_PADDING)
    };
}

function randomBetween(min, max) {
    return min + Math.random() * Math.max(0, max - min);
}

function randomizePosition() {
    const bounds = getBounds();
    x = randomBetween(EDGE_PADDING, bounds.maxX);
    y = randomBetween(EDGE_PADDING, bounds.maxY);
}

function clampPosition() {
    const bounds = getBounds();
    x = Math.min(Math.max(EDGE_PADDING, x), bounds.maxX);
    y = Math.min(Math.max(EDGE_PADDING, y), bounds.maxY);
}

function render() {
    watermark.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function tick(now) {
    const delta = Math.min(48, now - lastTime) / 1000;
    lastTime = now;

    const bounds = getBounds();
    x += dx * SPEED * delta;
    y += dy * SPEED * delta;

    if (x <= EDGE_PADDING || x >= bounds.maxX) {
        x = Math.min(Math.max(EDGE_PADDING, x), bounds.maxX);
        dx *= -1;
    }

    if (y <= EDGE_PADDING || y >= bounds.maxY) {
        y = Math.min(Math.max(EDGE_PADDING, y), bounds.maxY);
        dy *= -1;
    }

    render();
    animationFrame = requestAnimationFrame(tick);
}

function start() {
    if (animationFrame || reduceMotion.matches) return;
    watermark.classList.add('is-visible');
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(tick);
}

function stop() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
}

window.addEventListener('resize', () => {
    clampPosition();
    render();
});

reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
        stop();
    } else {
        start();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stop();
    } else {
        start();
    }
});

randomizePosition();
render();
start();
