/* ===== VTuber Forge — js/core/debug.js ===== */
// Logging, error handling, dan Android bridge

window.allLogs = [];

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c => 
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])
);

window.onerror = function(msg, url, line, col, error) {
    const errMsg = "JS_ERROR: " + msg + " at line " + line;
    dbg(errMsg);
    if(error && error.stack) dbg("STACK: " + error.stack);
    return false;
};

window.addEventListener('unhandledrejection', event => { 
    dbg("Promise Error: " + event.reason); 
});

window.handleAndroidBack = function() {
    if (confirm("Keluar? Pastikan sudah Save.")) {
        if (window.AndroidBridge && window.AndroidBridge.exitApp) 
            window.AndroidBridge.exitApp();
    }
};

window.dbg = function(msg) {
    window.allLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if(window.allLogs.length > 100) window.allLogs.shift();
    
    const el = document.getElementById('debugOverlay'); 
    if (!el) return;
    
    const t = new Date().toLocaleTimeString();
    el.textContent = `[${t}] ${msg}\n` + el.textContent;
    if (el.textContent.split('\n').length > 15) 
        el.textContent = el.textContent.split('\n').slice(0, 15).join('\n');
    
    try { 
        if (window.AndroidBridge) window.AndroidBridge.log(msg); 
    } catch(e) {}
};

window.toggleDebug = function() {
    const el = document.getElementById('debugOverlay');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

setTimeout(() => { dbg('=== DEBUG READY (tap 🐛 to view) ==='); }, 500);
