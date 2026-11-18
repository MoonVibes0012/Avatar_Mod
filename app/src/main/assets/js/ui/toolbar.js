/* ===== VTuber Forge — js/ui/toolbar.js ===== */
// Toolbar shortcuts, Input handlers, Panel controls, Animation UI

dbg("=== ENV: innerWidth=" + window.innerWidth + " innerHeight=" + window.innerHeight + " dpr=" + window.devicePixelRatio + " screenW=" + screen.width + " ua=" + (navigator.userAgent.includes("Mobile") ? "mobile" : "desktop") + " mediaMatch=" + window.matchMedia('(max-width: 700px)').matches);

// === TOOLBAR SHORTCUT BINDINGS ===
const btnUndo = $('btnUndo');
const btnRedo = $('btnRedo');
const btnSave = $('btnSave');
const btnImport = $('btnImport');
const btnScreenshot = $('btnScreenshot');

if (btnUndo) btnUndo.onclick = () => { const b = $('undo'); if (b) b.click(); };
if (btnRedo) btnRedo.onclick = () => { const b = $('redo'); if (b) b.click(); };
if (btnSave) btnSave.onclick = () => { const b = $('save'); if (b) b.click(); };
if (btnImport) btnImport.onclick = () => { const b = $('import'); if (b) b.click(); };
if (btnScreenshot) btnScreenshot.onclick = () => { const b = $('screenshot'); if (b) b.click(); };

// === INPUT HANDLERS ===
document.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
});

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); $('undo').click(); }
        if (e.key === 'y') { e.preventDefault(); $('redo').click(); }
    } else {
        if (e.key === 'z' || e.key === 'Z') { $('undo').click(); }
        if (e.key === 'y' || e.key === 'Y') { $('redo').click(); }
    }
});

let snapEnabled = false;
$('snapToggle').onchange = (e) => {
    snapEnabled = e.target.checked;
    $('status').textContent = snapEnabled ? 'Grid Snap: ON (0.5 unit)' : 'Grid Snap: OFF';
};
const snapVal = (v) => snapEnabled ? Math.round(v * 2) / 2 : v;

$('texScale').oninput = (e) => { $('texScaleOut').textContent = e.target.value; };

const bind = (id, outId, fn) => {
    $(id).oninput = () => {
        let raw = parseFloat($(id).value);
        if (!isFinite(raw)) raw = 0;
        const v = snapVal(raw);
        $(id).value = v;
        $(outId).textContent = v.toFixed(2);
        if (S.selected) fn(v);
    };
    $(id).onchange = saveState;
};

bind('px', 'pxo', v => S.selected.setPosition(v, S.selected.getPosition().y, S.selected.getPosition().z));
bind('py', 'pyo', v => S.selected.setPosition(S.selected.getPosition().x, v, S.selected.getPosition().z));
bind('pz', 'pzo', v => S.selected.setPosition(S.selected.getPosition().x, S.selected.getPosition().y, v));

bind('rx', 'rxo', v => {
    S.selected._animSpin = false; S.selected._animWobble = false;
    S.selected.setEulerAngles(v, S.selected.getEulerAngles().y, S.selected.getEulerAngles().z);
    if (S.selected._baseRot) S.selected._baseRot.x = v;
});
bind('ry', 'ryo', v => {
    S.selected._animSpin = false; S.selected._animWobble = false;
    S.selected.setEulerAngles(S.selected.getEulerAngles().x, v, S.selected.getEulerAngles().z);
    if (S.selected._baseRot) S.selected._baseRot.y = v;
});
bind('rz', 'rzo', v => {
    S.selected._animSpin = false; S.selected._animWobble = false;
    S.selected.setEulerAngles(S.selected.getEulerAngles().x, S.selected.getEulerAngles().y, v);
    if (S.selected._baseRot) S.selected._baseRot.z = v;
});

$('sc').oninput = () => { let v = parseFloat($('sc').value); $('sco').textContent = v.toFixed(2); if (S.selected) S.selected.setLocalScale(v, v, v); };
$('sc').onchange = saveState;

$('color').oninput = (e) => {
    if (!S.selected) return;
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    S.selected.findComponents('render').forEach(comp => {
        comp.meshInstances.forEach(mi => {
            if (mi.material) {
                const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                mats.forEach(m => { if (m) { m.diffuse = new pc.Color(r, g, b); } });
            }
        });
    });
};
$('color').onchange = () => {
    if (!S.selected) return;
    S.selected.findComponents('render').forEach(comp => {
        comp.meshInstances.forEach(mi => {
            if (mi.material) {
                const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                mats.forEach(m => { if (m) m.update(); });
            }
        });
    });
    saveState();
};

$('rough').oninput = (e) => {
    let v = parseFloat(e.target.value); $('rougho').textContent = v.toFixed(2);
    if (S.selected) {
        S.selected.findComponents('render').forEach(comp => comp.meshInstances.forEach(mi => {
            if (mi.material) { const mats = Array.isArray(mi.material) ? mi.material : [mi.material]; mats.forEach(m => { if (m) { m.gloss = v; m.update(); } }); }
        }));
    }
};
$('rough').onchange = saveState;

$('metal').oninput = (e) => {
    let v = parseFloat(e.target.value); $('meto').textContent = v.toFixed(2);
    if (S.selected) {
        S.selected.findComponents('render').forEach(comp => comp.meshInstances.forEach(mi => {
            if (mi.material) { const mats = Array.isArray(mi.material) ? mi.material : [mi.material]; mats.forEach(m => { if (m) { m.metalness = v; m.update(); } }); }
        }));
    }
};
$('metal').onchange = saveState;

$('animSpin').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animSpin = !S.selected._animSpin; saveState(); $('status').textContent = "Auto-Spin: " + (S.selected._animSpin ? "ON" : "OFF"); };
$('animPulse').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animPulse = !S.selected._animPulse; saveState(); $('status').textContent = "Idle Pulse: " + (S.selected._animPulse ? "ON" : "OFF"); };
$('animWobble').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animWobble = !S.selected._animWobble; saveState(); $('status').textContent = "Spring Wobble: " + (S.selected._animWobble ? "ON" : "OFF"); };

// === PANEL CONTROLS ===
function closeSidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('mobile-open');
    panel.style.display = 'none';
}
window.closeSidePanel = closeSidePanel;

function toggleSidePanel(panelId) {
    dbg(">>> toggleSidePanel called: " + panelId);
    const panel = document.getElementById(panelId);
    if (!panel) { dbg("!!! ERROR: panel #" + panelId + " NOT FOUND"); return; }
    
    const isMobileLayout = window.matchMedia('(max-width: 700px)').matches;
    dbg(">>> isMobileLayout=" + isMobileLayout + " | innerWidth=" + window.innerWidth + " | DPR=" + window.devicePixelRatio);
    
    if (!isMobileLayout) {
        dbg(">>> DESKTOP LAYOUT: panel sudah tampil permanen di grid");
        panel.scrollTop = 0;
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = panelId === 'left' ? "Panel Menu aktif di sisi kiri." : "Panel Inspector aktif di sisi kanan.";
        return;
    }
    
    const otherId = panelId === 'left' ? 'right' : 'left';
    const isOpen = panel.classList.contains('mobile-open');
    dbg(">>> isOpen=" + isOpen);
    
    if (isOpen) {
        closeSidePanel(panelId);
        dbg(">>> PANEL CLOSED: " + panelId);
    } else {
        closeSidePanel(otherId);
        panel.classList.add('mobile-open');
        panel.style.display = 'block';
        panel.scrollTop = 0;
        dbg(">>> PANEL OPENED: " + panelId + " | display=" + panel.style.display);
    }
}

function bindOnce(el, eventName, handler) {
    if (!el) return;
    const key = 'bound_' + eventName;
    if (el.dataset[key] === '1') return;
    el.dataset[key] = '1';
    el.addEventListener(eventName, handler);
}

function initPanelControls() {
    const partsBtn = document.getElementById('parts');
    const inspectorBtn = document.getElementById('inspector');
    dbg("=== Binding buttons ===");
    dbg("parts exists: " + !!partsBtn + " | inspector exists: " + !!inspectorBtn);
    
    bindOnce(partsBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); dbg(">>> PARTS CLICKED"); toggleSidePanel('left'); });
    bindOnce(inspectorBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); dbg(">>> INSPECTOR CLICKED"); toggleSidePanel('right'); });
    
    document.querySelectorAll('.btn-close-panel').forEach(btn => {
        bindOnce(btn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const panelId = btn.getAttribute('data-panel');
            dbg(">>> CLOSE CLICKED: " + panelId);
            if (panelId) {
                closeSidePanel(panelId);
                const statusEl = document.getElementById('status');
                if (statusEl) statusEl.textContent = "Panel " + panelId + " ditutup.";
            }
        });
    });
}
initPanelControls();

window.addEventListener('resize', () => {
    dbg("=== RESIZE: innerWidth=" + window.innerWidth + " | matchMedia=" + window.matchMedia('(max-width: 700px)').matches);
    if (!window.matchMedia('(max-width: 700px)').matches) {
        const left = document.getElementById('left');
        const right = document.getElementById('right');
        if (left) { left.style.removeProperty('display'); left.classList.remove('mobile-open'); }
        if (right) { right.style.removeProperty('display'); right.classList.remove('mobile-open'); }
    }
});

// === GLOBAL ANIMATION CONTROLS ===
$('animSelect').onchange = (e) => {
    if (!S.selected || !S.selected._animAssets) return;
    const idx = parseInt(e.target.value);
    if (isNaN(idx)) return;
    if (!S.selected.animation) {
        S.selected.addComponent('animation');
    }
    S.selected.animation.asset = S.selected._animAssets[idx];
    S.selected.animation.loop = true;
    $('status').textContent = "Animasi siap: " + S.selected._animNames[idx];
};

$('animPlay').onclick = () => {
    if (S.selected && S.selected.animation && S.selected.animation.asset) {
        S.selected.animation.play();
        $('status').textContent = "▶ Playing: " + S.selected.animation.asset.name;
    }
};
$('animPause').onclick = () => {
    if (S.selected && S.selected.animation) {
        S.selected.animation.pause();
        $('status').textContent = "⏸ Paused";
    }
};
$('animStop').onclick = () => {
    if (S.selected && S.selected.animation) {
        S.selected.animation.stop();
        $('status').textContent = "⏹ Stopped";
    }
};

dbg("=== ui.js DONE ===");
