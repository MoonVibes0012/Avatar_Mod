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

// === MENU FILE: IMPORT + EXPORT VRM (x-vrm) ===
if ($('importMenu')) $('importMenu').onclick = () => {
    const b = $('import');
    if (b) b.click();
};

if ($('x-vrm')) $('x-vrm').onclick = () => {
    if (typeof exportVRM === 'function') {
        exportVRM();
    } else {
        alert("Fungsi exportVRM tidak ditemukan.\n\nPastikan js/io/export.js ter-load dengan benar.");
    }
};

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
if ($('snapToggle')) $('snapToggle').onchange = (e) => {
    snapEnabled = e.target.checked;
    $('status').textContent = snapEnabled ? 'Grid Snap: ON (0.5 unit)' : 'Grid Snap: OFF';
};
const snapVal = (v) => snapEnabled ? Math.round(v * 2) / 2 : v;

if ($('texScale')) $('texScale').oninput = (e) => { $('texScaleOut').textContent = e.target.value; };

const bind = (id, outId, fn) => {
    if (!$(id)) return;
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

if ($('sc')) {
    $('sc').oninput = () => {
        let v = parseFloat($('sc').value);
        if (!isFinite(v) || v === 0) v = 1;
        $('sco').textContent = v.toFixed(2);
        if (S.selected) S.selected.setLocalScale(v, v, v);
    };
    $('sc').onchange = saveState;
}

if ($('color')) {
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
}

if ($('rough')) {
    $('rough').oninput = (e) => {
        let v = parseFloat(e.target.value); $('rougho').textContent = v.toFixed(2);
        if (S.selected) {
            S.selected.findComponents('render').forEach(comp => comp.meshInstances.forEach(mi => {
                if (mi.material) { const mats = Array.isArray(mi.material) ? mi.material : [mi.material]; mats.forEach(m => { if (m) { m.gloss = v; m.update(); } }); }
            }));
        }
    };
    $('rough').onchange = saveState;
}

if ($('metal')) {
    $('metal').oninput = (e) => {
        let v = parseFloat(e.target.value); $('meto').textContent = v.toFixed(2);
        if (S.selected) {
            S.selected.findComponents('render').forEach(comp => comp.meshInstances.forEach(mi => {
                if (mi.material) { const mats = Array.isArray(mi.material) ? mi.material : [mi.material]; mats.forEach(m => { if (m) { m.metalness = v; m.update(); } }); }
            }));
        }
    };
    $('metal').onchange = saveState;
}

if ($('animSpin')) $('animSpin').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animSpin = !S.selected._animSpin; saveState(); $('status').textContent = "Auto-Spin: " + (S.selected._animSpin ? "ON" : "OFF"); };
if ($('animPulse')) $('animPulse').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animPulse = !S.selected._animPulse; saveState(); $('status').textContent = "Idle Pulse: " + (S.selected._animPulse ? "ON" : "OFF"); };
if ($('animWobble')) $('animWobble').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animWobble = !S.selected._animWobble; saveState(); $('status').textContent = "Spring Wobble: " + (S.selected._animWobble ? "ON" : "OFF"); };

// === PANEL CONTROLS (FIXED) ===
// Visibilitas panel mobile SEPENUHNYA diatur oleh class .mobile-open.
// Tidak ada lagi inline style 'display' yang bisa bikin panel "hilang permanen".

function isMobileLayout() {
    return window.matchMedia('(max-width: 700px)').matches;
}

function closeSidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('mobile-open');
    panel.style.removeProperty('display');
}
window.closeSidePanel = closeSidePanel;

function toggleSidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) { dbg("!!! ERROR: panel #" + panelId + " NOT FOUND"); return; }

    // Self-heal: bersihkan inline display dari sesi lama / kode eksternal
    panel.style.removeProperty('display');

    if (!isMobileLayout()) {
        // Desktop: panel selalu tampil via CSS grid. Tidak perlu apa-apa.
        panel.scrollTop = 0;
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = panelId === 'left'
                ? "Panel Menu aktif di sisi kiri."
                : "Panel Inspector aktif di sisi kanan.";
        }
        return;
    }

    const otherId = panelId === 'left' ? 'right' : 'left';
    const isOpen = panel.classList.contains('mobile-open');

    if (isOpen) {
        closeSidePanel(panelId);
    } else {
        closeSidePanel(otherId);
        panel.classList.add('mobile-open');
        panel.scrollTop = 0;
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
    dbg("=== Binding panel buttons: parts=" + !!partsBtn + " inspector=" + !!inspectorBtn);

    bindOnce(partsBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); toggleSidePanel('left'); });
    bindOnce(inspectorBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); toggleSidePanel('right'); });

    document.querySelectorAll('.btn-close-panel').forEach(btn => {
        bindOnce(btn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const panelId = btn.getAttribute('data-panel');
            if (panelId) {
                closeSidePanel(panelId);
                const statusEl = document.getElementById('status');
                if (statusEl) statusEl.textContent = "Panel " + panelId + " ditutup.";
            }
        });
    });

    // Tap di area viewport (di luar panel) → tutup panel (mobile only)
    const viewportEl = document.querySelector('.viewport');
    if (viewportEl) {
        viewportEl.addEventListener('pointerdown', () => {
            if (!isMobileLayout()) return;
            closeSidePanel('left');
            closeSidePanel('right');
        }, { passive: true });
    }
}
initPanelControls();

// Resize: jika user pindah dari mobile → desktop, bersihkan sisa class .mobile-open
window.addEventListener('resize', () => {
    if (!isMobileLayout()) {
        document.getElementById('left')?.classList.remove('mobile-open');
        document.getElementById('right')?.classList.remove('mobile-open');
    }
});

// === GLOBAL ANIMATION CONTROLS ===
if ($('animSelect')) $('animSelect').onchange = (e) => {
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

if ($('animPlay')) $('animPlay').onclick = () => {
    if (S.selected && S.selected.animation && S.selected.animation.asset) {
        S.selected.animation.play();
        $('status').textContent = "▶ Playing: " + S.selected.animation.asset.name;
    }
};
if ($('animPause')) $('animPause').onclick = () => {
    if (S.selected && S.selected.animation) {
        S.selected.animation.pause();
        $('status').textContent = "⏸ Paused";
    }
};
if ($('animStop')) $('animStop').onclick = () => {
    if (S.selected && S.selected.animation) {
        S.selected.animation.stop();
        $('status').textContent = "⏹ Stopped";
    }
};

dbg("=== toolbar.js DONE ===");
