/* ===== VTuber Forge — js/core/init.js ===== */
// Inisialisasi aplikasi, canvas, dan scene dasar

let isAppReady = false;

// Canvas & App initialization
const canvas = document.getElementById('gl');
const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    graphicsDeviceOptions: { antialias: false, alpha: false, preserveDrawingBuffer: false }
});

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); 
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2.0);
app.graphicsDevice.precision = 'highp';

let resizeTimeout;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        app.resizeCanvas();
        app.render();
        if (typeof window.resetCameraGesture === 'function') 
            window.resetCameraGesture();
    }, 200);
});

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('webglcontextlost', function(event) { 
    event.preventDefault(); 
    alert("Memori Grafis Penuh! Memuat ulang..."); 
    location.reload(); 
}, false);

app.start();
isAppReady = true;

// Scene setup
const pivot = new pc.Entity('cameraPivot'); 
app.root.addChild(pivot);

const camera = new pc.Entity('camera');
camera.addComponent('camera', { 
    clearColor: new pc.Color(0.03, 0.03, 0.04), 
    farClip: 150, 
    nearClip: 0.5 
});
pivot.addChild(camera);

app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.4);

const light = new pc.Entity('light');
light.addComponent('light', { type: 'directional', castShadows: false, intensity: 1.0 });
light.setEulerAngles(45, 30, 0); 
app.root.addChild(light);

const fillLight = new pc.Entity('fillLight');
fillLight.addComponent('light', { type: 'directional', intensity: 0.5 });
fillLight.setEulerAngles(-45, -30, 0); 
app.root.addChild(fillLight);

const ground = new pc.Entity('ground');
ground.addComponent('render', { type: 'plane' });
const matG = new pc.StandardMaterial(); 
matG.diffuse = new pc.Color(0.1, 0.1, 0.15); 
matG.update(); 
ground.render.material = matG;
ground.setLocalScale(20, 1, 20); 
app.root.addChild(ground);

$('toggleGrid').onchange = (e) => { ground.enabled = e.target.checked; };

$('bgColor').onchange = (e) => {
    const v = e.target.value;
    let c;
    if (v === 'light') c = new pc.Color(1, 1, 1);
    else if (v === 'green') c = new pc.Color(0, 1, 0);
    else if (v === 'blue') c = new pc.Color(0, 0, 1);
    else c = new pc.Color(0.03, 0.03, 0.04);
    if (camera.camera) { camera.camera.clearColor = c; }
    $('status').textContent = "Background: " + v;
};

// Memory management
window.clearUndoStack = function() {
    undoStack = [];
    redoStack = [];
    if (typeof meshCachePool !== 'undefined') meshCachePool.clear();
    dbg("⚠ Undo/redo/meshCache cleared (low memory)");
};

// Render loop
let targetFPS = 60, lastFrameTime = performance.now(), isRendering = true;
app.autoRender = false;

function renderLoop(now) {
    if (!isRendering) return;
    requestAnimationFrame(renderLoop);
    if (now - lastFrameTime > 1000 / targetFPS) {
        let dt = (now - lastFrameTime) / 1000;
        dt = Math.min(dt, 0.1);
        if (dt === 0) dt = 0.016;
        lastFrameTime = now;
        app.update(dt); 
        app.render();
    }
}

requestAnimationFrame(renderLoop);

$('fpsLimit').oninput = (e) => { 
    targetFPS = parseInt(e.target.value); 
    $('fpsOut').textContent = targetFPS; 
};

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { 
        isRendering = false; 
        $('loadingOverlay').style.display = 'none'; 
    } else { 
        isRendering = true; 
        lastFrameTime = performance.now(); 
        requestAnimationFrame(renderLoop); 
    }
});
