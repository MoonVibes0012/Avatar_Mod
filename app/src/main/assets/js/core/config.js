/* ===== VTuber Forge — js/core/config.js ===== */
// Konfigurasi global, state aplikasi, dan helper utilitas

(function () {
    'use strict';

    const CONFIG = {
        MAX_UNDO: 20,
        MAX_IMPORT_SIZE: 20 * 1024 * 1024, // 20 MB
        MAX_VERTEX_EDIT: 5000,
        MAX_SMOOTH_VERTEX: 20000,
        MAX_DUPLICATE_VERTEX: 50000,
        MAX_DUPLICATE_CACHE_VERTEX: 200000
    };
    window.CONFIG = CONFIG;

    const S = {
        selected: null,
        objects: [],
        mode: 'object',
        maxId: 1,
        isLoadingModel: false,
        isSmoothing: false
    };
    window.S = S;

    if (!Array.isArray(window.undoStack)) {
        window.undoStack = [];
    }
    if (!Array.isArray(window.redoStack)) {
        window.redoStack = [];
    }

    function getPcApp() {
        if (typeof window.app !== 'undefined' && window.app) {
            return window.app;
        }
        try {
            if (typeof app !== 'undefined' && app) {
                return app;
            }
        } catch (e) {}
        return null;
    }
    window.getPcApp = getPcApp;

    function rgbToHex(r, g, b) {
        const toByte = (v) => {
            const num = Number(v);
            if (!isFinite(num)) return 0;
            const clamped = Math.max(0, Math.min(1, num));
            return Math.round(clamped * 255);
        };
        return '#' + [toByte(r), toByte(g), toByte(b)]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('');
    }
    window.rgbToHex = rgbToHex;

    function escapeHtml(str) {
        return String(str === undefined || str === null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }
    window.escapeHtml = escapeHtml;
})();

var undoStack = window.undoStack;
var redoStack = window.redoStack;
