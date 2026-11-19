/* ===== VTuber Forge — js/ui/toolbar.js ===== */
// Toolbar shortcuts, Input handlers, Panel controls, Animation UI

dbg("=== ENV: innerWidth=" + window.innerWidth + " innerHeight=" + window.innerHeight + " dpr=" + window.devicePixelRatio);

// === TOOLBAR SHORTCUT BINDINGS ===
if ($('btnUndo')) $('btnUndo').onclick = () => { const b = $('undo'); if (b) b.click(); };
if ($('btnRedo')) $('btnRedo').onclick = () => { const b = $('redo'); if (b) b.click(); };
if ($('btnSave')) $('btnSave').onclick = () => { const b = $('save'); if (b) b.click(); };
if ($('btnImport')) $('btnImport').onclick = () => { const b = $('import'); if (b) b.click(); };
if ($('btnScreenshot')) $('btnScreenshot').onclick = () => { const b = $('screenshot'); if (b) b.click(); };

// === MENU FILE: IMPORT + EXPORT VRM (x-vrm) ===
if ($('importMenu')) $('importMenu').onclick = () => {
    const b = $('import');
    if (b) b.click();
};
if ($('x-vrm')) $('x-vrm').onclick = () => {
    if (typeof exportVRM === 'function') exportVRM();
    else alert("Fungsi exportVRM tidak ditemukan.\n\nPastikan js/io/export.js ter-load.");
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

// ============================================================
// BIND: number input + slider geser + label (2 arah)
// ============================================================
const bind = (id, outId, fn, sliderId, sMin, sMax, decimals) => {
    if (!$(id) || !$(outId)) return;
    if (decimals === undefined) decimals = 2;

    const apply = (v, fromSlider) => {
        if (!isFinite(v)) v = 0;
        if (fromSlider) v = Math.max(sMin, Math.min(sMax, v));
        $(id).value = v;
        if (sliderId && $(sliderId)) {
            const clamped = Math.max(sMin, Math.min(sMax, v));
            $(sliderId).value = clamped;
        }
        $(outId).textContent = v.toFixed(decimals);
        if (S.selected) fn(v);
    };

    $(id).oninput = () => {
        let raw = parseFloat($(id).value);
        if (!isFinite(raw)) raw = 0;
        apply(snapVal(raw), false);
    };
    $(id).onchange = saveState;

    if (sliderId && $(sliderId)) {
        $(sliderId).oninput = () => {
            const v = parseFloat($(sliderId).value);
            apply(snapVal(v), true);
        };
        $(sliderId).onchange = saveState;
    }
};

// Position (slider -10..10)
bind('px', 'pxo', v => S.selected.setPosition(v, S.selected.getPosition().y, S.selected.getPosition().z), 'pxR', -10, 10, 2);
bind('py', 'pyo', v => S.selected.setPosition(S.selected.getPosition().x, v, S.selected.getPosition().z), 'pyR', -10, 10, 2);
bind('pz', 'pzo', v => S.selected.setPosition(S.selected.getPosition().x, S.selected.getPosition().y, v), 'pzR', -10, 10, 2);

// Rotation (slider -180..180)
bind('rx', 'rxo', v => {
    S.selected._animSpin = false; S.selected._animWobble = false;
    S.selected.setEulerAngles(v, S.selected.getEulerAngles().y, S.selected.getEulerAngles().z);
    if (S.selected._baseRot) S.selected._baseRot.x = v;
}, 'rxR', -180, 180, 0);
bind('ry', 'ryo', v => {
    S.selected._animSpin = false; S.selected._animWobble = false;
    S.selected.setEulerAngles(S.selected.getEulerAngles().x, v, S.selected.getEulerAngles().z);
    if (S.selected._baseRot) S.selected._baseRot.y = v;
}, 'ryR', -180, 180, 0);
bind('rz', 'rzo', v => {
    S.selected._animSpin = false; S.selected._animWobble = false;
    S.selected.setEulerAngles(S.selected.getEulerAngles().x, S.selected.getEulerAngles().y, v);
    if (S.selected._baseRot) S.selected._baseRot.z = v;
}, 'rzR', -180, 180, 0);

// Scale (slider 0.1..5) — guard v<=0
if ($('sc') && $('sco')) {
    const applyScale = (v, fromSlider) => {
        if (!isFinite(v) || v <= 0) v = 0.01;
        if (fromSlider) v = Math.max(0.1, Math.min(5, v));
        $('sc').value = v;
        if ($('scR')) $('scR').value = Math.max(0.1, Math.min(5, v));
        $('sco').textContent = v.toFixed(2);
        if (S.selected) S.selected.setLocalScale(v, v, v);
    };
    $('sc').oninput = () => {
        let raw = parseFloat($('sc').value);
        if (!isFinite(raw)) raw = 1;
        applyScale(raw, false);
    };
    $('sc').onchange = saveState;
    if ($('scR')) {
        $('scR').oninput = () => applyScale(parseFloat($('scR').value), true);
        $('scR').onchange = saveState;
    }
}

// Material
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

// Animation quick toggles
if ($('animSpin')) $('animSpin').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animSpin = !S.selected._animSpin; saveState(); $('status').textContent = "Auto-Spin: " + (S.selected._animSpin ? "ON" : "OFF"); };
if ($('animPulse')) $('animPulse').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animPulse = !S.selected._animPulse; saveState(); $('status').textContent = "Idle Pulse: " + (S.selected._animPulse ? "ON" : "OFF"); };
if ($('animWobble')) $('animWobble').onclick = () => { if (!S.selected) return alert("Pilih objek dulu!"); S.selected._animWobble = !S.selected._animWobble; saveState(); $('status').textContent = "Spring Wobble: " + (S.selected._animWobble ? "ON" : "OFF"); };

// === PANEL CONTROLS (drawer mode di semua orientasi) ===
function closeSidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('mobile-open');
    panel.style.removeProperty('display');
}
window.closeSidePanel = closeSidePanel;

function toggleSidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.style.removeProperty('display');
    const otherId = panelId === 'left' ? 'right' : 'left';
    if (panel.classList.contains('mobile-open')) {
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
    bindOnce(partsBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); toggleSidePanel('left'); });
    bindOnce(inspectorBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); toggleSidePanel('right'); });
    document.querySelectorAll('.btn-close-panel').forEach(btn => {
        bindOnce(btn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const panelId = btn.getAttribute('data-panel');
            if (panelId) closeSidePanel(panelId);
        });
    });
}
initPanelControls();

// === ANIMATION CLIP CONTROLS ===
if ($('animSelect')) $('animSelect').onchange = (e) => {
    if (!S.selected || !S.selected._animAssets) return;
    const idx = parseInt(e.target.value);
    if (isNaN(idx)) return;
    if (!S.selected.animation) S.selected.addComponent('animation');
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
    if (S.selected && S.selected.animation) { S.selected.animation.pause(); $('status').textContent = "⏸ Paused"; }
};
if ($('animStop')) $('animStop').onclick = () => {
    if (S.selected && S.selected.animation) { S.selected.animation.stop(); $('status').textContent = "⏹ Stopped"; }
};

dbg("=== toolbar.js DONE ===");
