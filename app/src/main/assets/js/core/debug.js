/* ===== VTuber Forge — js/core/debug.js ===== */
// Debug console overlay, bridge ke Android, dan global error handlers

const allLogs = [];
window.allLogs = allLogs;

function setDebugStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function getDebugOverlay() {
    return document.getElementById('debugOverlay');
}

function dbg(msg) {
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const line = `[${ts}] ${msg}`;
    allLogs.push(line);
    if (allLogs.length > 500) {
        allLogs.splice(0, allLogs.length - 500);
    }

    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        try { console.log(line); } catch (e) {}
    }

    if (window.AndroidBridge && typeof window.AndroidBridge.log === 'function') {
        try {
            window.AndroidBridge.log(line);
        } catch (e) {
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                try { console.warn('AndroidBridge.log failed:', e.message); } catch (ignored) {}
            }
        }
    }

    const dbgEl = getDebugOverlay();
    if (dbgEl) {
        try {
            const safeEscape = typeof window.escapeHtml === 'function'
                ? window.escapeHtml
                : (str) => String(str).replace(/[&<>"']/g, c => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[c]));
            dbgEl.innerHTML += safeEscape(line) + '<br>';
            dbgEl.scrollTop = dbgEl.scrollHeight;
        } catch (e) {}
    }
}
window.dbg = dbg;

function toggleDebug() {
    const dbgEl = getDebugOverlay();
    if (!dbgEl) return;
    const isVisible = dbgEl.style.display === 'block';
    dbgEl.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        dbgEl.scrollTop = dbgEl.scrollHeight;
        setDebugStatus("Debug overlay ON — klik lagi untuk sembunyikan");
    } else {
        setDebugStatus("Debug overlay OFF");
    }
}
window.toggleDebug = toggleDebug;

window.handleAndroidBack = function () {
    const leftPanel = document.getElementById('left');
    const rightPanel = document.getElementById('right');
    const leftOpen = !!(leftPanel && leftPanel.classList.contains('mobile-open'));
    const rightOpen = !!(rightPanel && rightPanel.classList.contains('mobile-open'));

    if (leftOpen || rightOpen) {
        if (typeof window.__vtfSetPanel === 'function') {
            if (leftOpen) window.__vtfSetPanel('left', false);
            if (rightOpen) window.__vtfSetPanel('right', false);
        } else {
            if (leftPanel) leftPanel.classList.remove('mobile-open');
            if (rightPanel) rightPanel.classList.remove('mobile-open');
            const backdrop = document.getElementById('panelBackdrop');
            if (backdrop) backdrop.hidden = true;
        }
        return true;
    }

    if (window.AndroidBridge && typeof window.AndroidBridge.exitApp === 'function') {
        window.AndroidBridge.exitApp();
        return true;
    }

    return false;
};

window.addEventListener('error', function (e) {
    const msg = `UNCAUGHT ERROR: ${e.message || 'Unknown error'} at ${(e.filename || 'unknown')}:${e.lineno || 0}:${e.colno || 0}`;
    dbg(msg);
    setDebugStatus("⚠ Error: " + (e.message || 'Terjadi kesalahan'));
});

window.addEventListener('unhandledrejection', function (e) {
    const reason = e && e.reason ? (e.reason.message || String(e.reason)) : 'Unknown rejection';
    dbg("UNHANDLED PROMISE: " + reason);
    setDebugStatus("⚠ Promise Error: " + reason);
});

dbg("=== debug.js LOADED ===");
