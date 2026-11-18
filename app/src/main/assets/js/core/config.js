/* ===== VTuber Forge — js/core/config.js ===== */
// Konfigurasi global dan state management

const CONFIG = {
    MAX_VERTEX_SAVE: 50000,
    MAX_IMPORT_SIZE: 20 * 1024 * 1024, // 20 MB
    TAP_THRESHOLD: 150,
    MAX_UNDO: 5
};

// Global state object
const S = {
    objects: [],
    selected: null,
    maxId: 1,
    mode: 'object',
    isLoadingModel: false,
    isSmoothing: false
};

// Undo/Redo stacks
let undoStack = [];
let redoStack = [];

// Helper: Get element by ID
const $ = id => document.getElementById(id);

// Helper: RGB to Hex converter
const rgbToHex = (r, g, b) => '#' + [r,g,b].map(c => 
    Math.round(c * 255).toString(16).padStart(2, '0')
).join('');
