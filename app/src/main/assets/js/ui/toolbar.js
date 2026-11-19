/* ===== VTuber Forge — js/ui/toolbar.js ===== */
// Toolbar shortcuts, Input handlers, Panel controls, Animation UI

function setToolbarStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logToolbar(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function byId(id) {
    return document.getElementById(id);
}

logToolbar("=== ENV: innerWidth=" + window.innerWidth + " innerHeight=" + window.innerHeight + " dpr=" + (window.devicePixelRatio || 1));

// === TOOLBAR SHORTCUT BINDINGS ===
if (byId('btnUndo')) {
    byId('btnUndo').onclick = () => {
        if (typeof triggerUndo === 'function') triggerUndo();
        else if (byId('undo')) byId('undo').click();
    };
}
if (byId('btnRedo')) {
    byId('btnRedo').onclick = () => {
        if (typeof triggerRedo === 'function') triggerRedo();
        else if (byId('redo')) byId('redo').click();
    };
}
if (byId('btnSave')) {
    byId('btnSave').onclick = () => {
        if (typeof triggerSaveScene === 'function') triggerSaveScene();
        else if (byId('save')) byId('save').click();
    };
}
if (byId('btnImport')) {
    byId('btnImport').onclick = () => {
        const f = byId('file');
        if (f) f.click();
    };
}
if (byId('btnScreenshot')) {
    byId('btnScreenshot').onclick = () => {
        if (typeof takeScreenshot === 'function') takeScreenshot();
        else if (byId('screenshot')) byId('screenshot').click();
    };
}

// === MENU FILE: IMPORT + EXPORT VRM (x-vrm) ===
if (byId('importMenu')) {
    byId('importMenu').onclick = () => {
        const f = byId('file');
        if (f) f.click();
    };
}
if (byId('x-vrm')) {
    byId('x-vrm').onclick = () => {
        if (typeof exportVRM === 'function') exportVRM();
        else alert("Fungsi exportVRM tidak ditemukan.\n\nPastikan js/io/export.js ter-load.");
    };
}

// === INPUT HANDLERS ===
document.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
});

window.addEventListener('keydown', (e) => {
    if (!e.target || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (typeof triggerUndo === 'function') triggerUndo();
        }
        if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            if (typeof triggerRedo === 'function') triggerRedo();
        }
    } else {
        if (e.key === 'z' || e.key === 'Z') {
            if (typeof triggerUndo === 'function') triggerUndo();
        }
        if (e.key === 'y' || e.key === 'Y') {
            if (typeof triggerRedo === 'function') triggerRedo();
        }
    }
});

let snapEnabled = false;
if (byId('snapToggle')) {
    byId('snapToggle').onchange = (e) => {
        snapEnabled = !!e.target.checked;
        setToolbarStatus(snapEnabled ? 'Grid Snap: ON (0.5 unit)' : 'Grid Snap: OFF');
    };
}
const snapVal = (v) => snapEnabled ? Math.round(v * 2) / 2 : v;

if (byId('texScale')) {
    byId('texScale').oninput = (e) => {
        const out = byId('texScaleOut');
        if (out) out.textContent = e.target.value;
    };
}

// ============================================================
// BIND: number input + slider geser + label (2 arah)
// ============================================================
const bind = (id, outId, fn, sliderId, sMin, sMax, decimals) => {
    const numEl = byId(id);
    const outEl = byId(outId);
    if (!numEl || !outEl) return;
    if (decimals === undefined) decimals = 2;

    const apply = (v, fromSlider) => {
        if (!isFinite(v)) v = 0;
        if (fromSlider) v = Math.max(sMin, Math.min(sMax, v));
        numEl.value = String(v);
        const slEl = sliderId ? byId(sliderId) : null;
        if (slEl) {
            slEl.value = String(Math.max(sMin, Math.min(sMax, v)));
        }
        outEl.textContent = v.toFixed(decimals);
        if (S.selected) fn(v);
    };

    numEl.oninput = () => {
        let raw = parseFloat(numEl.value);
        if (!isFinite(raw)) raw = 0;
        apply(snapVal(raw), false);
    };
    numEl.onchange = () => { if (typeof saveState === 'function') saveState(); };

    const slEl = sliderId ? byId(sliderId) : null;
    if (slEl) {
        slEl.oninput = () => {
            const v = parseFloat(slEl.value);
            apply(snapVal(v), true);
        };
        slEl.onchange = () => { if (typeof saveState === 'function') saveState(); };
    }
};

bind('px', 'pxo', v => S.selected.setPosition(v, S.selected.getPosition().y, S.selected.getPosition().z), 'pxR', -10, 10, 2);
bind('py', 'pyo', v => S.selected.setPosition(S.selected.getPosition().x, v, S.selected.getPosition().z), 'pyR', -10, 10, 2);
bind('pz', 'pzo', v => S.selected.setPosition(S.selected.getPosition().x, S.selected.getPosition().y, v), 'pzR', -10, 10, 2);

bind('rx', 'rxo', v => {
    S.selected._animSpin = false;
    S.selected._animWobble = false;
    S.selected.setEulerAngles(v, S.selected.getEulerAngles().y, S.selected.getEulerAngles().z);
    if (S.selected._baseRot) S.selected._baseRot.x = v;
}, 'rxR', -180, 180, 0);
bind('ry', 'ryo', v => {
    S.selected._animSpin = false;
    S.selected._animWobble = false;
    S.selected.setEulerAngles(S.selected.getEulerAngles().x, v, S.selected.getEulerAngles().z);
    if (S.selected._baseRot) S.selected._baseRot.y = v;
}, 'ryR', -180, 180, 0);
bind('rz', 'rzo', v => {
    S.selected._animSpin = false;
    S.selected._animWobble = false;
    S.selected.setEulerAngles(S.selected.getEulerAngles().x, S.selected.getEulerAngles().y, v);
    if (S.selected._baseRot) S.selected._baseRot.z = v;
}, 'rzR', -180, 180, 0);

if (byId('sc') && byId('sco')) {
    const scEl = byId('sc');
    const scOut = byId('sco');
    const scREl = byId('scR');
    const applyScale = (v, fromSlider) => {
        if (!isFinite(v) || v <= 0) v = 0.01;
        if (fromSlider) v = Math.max(0.1, Math.min(5, v));
        scEl.value = String(v);
        if (scREl) scREl.value = String(Math.max(0.1, Math.min(5, v)));
        scOut.textContent = v.toFixed(2);
        if (S.selected) S.selected.setLocalScale(v, v, v);
    };
    scEl.oninput = () => {
        let raw = parseFloat(scEl.value);
        if (!isFinite(raw)) raw = 1;
        applyScale(raw, false);
    };
    scEl.onchange = () => { if (typeof saveState === 'function') saveState(); };
    if (scREl) {
        scREl.oninput = () => applyScale(parseFloat(scREl.value), true);
        scREl.onchange = () => { if (typeof saveState === 'function') saveState(); };
    }
}

if (byId('color')) {
    const colorEl = byId('color');
    colorEl.oninput = (e) => {
        if (!S.selected || typeof S.selected.findComponents !== 'function') return;
        const hex = e.target.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        S.selected.findComponents('render').forEach(comp => {
            if (!comp || !comp.meshInstances) return;
            comp.meshInstances.forEach(mi => {
                if (mi && mi.material) {
                    const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                    mats.forEach(m => { if (m) m.diffuse = new pc.Color(r, g, b); });
                }
            });
        });
    };
    colorEl.onchange = () => {
        if (!S.selected || typeof S.selected.findComponents !== 'function') return;
        S.selected.findComponents('render').forEach(comp => {
            if (!comp || !comp.meshInstances) return;
            comp.meshInstances.forEach(mi => {
                if (mi && mi.material) {
                    const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                    mats.forEach(m => { if (m && typeof m.update === 'function') m.update(); });
                }
            });
        });
        if (typeof saveState === 'function') saveState();
    };
}

if (byId('rough')) {
    const roughEl = byId('rough');
    roughEl.oninput = (e) => {
        const v = parseFloat(e.target.value);
        const out = byId('rougho');
        if (out && !isNaN(v)) out.textContent = v.toFixed(2);
        if (S.selected && !isNaN(v) && typeof S.selected.findComponents === 'function') {
            S.selected.findComponents('render').forEach(comp => {
                if (!comp || !comp.meshInstances) return;
                comp.meshInstances.forEach(mi => {
                    if (mi && mi.material) {
                        const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                        mats.forEach(m => {
                            if (m) {
                                m.gloss = v;
                                if (typeof m.update === 'function') m.update();
                            }
                        });
                    }
                });
            });
        }
    };
    roughEl.onchange = () => { if (typeof saveState === 'function') saveState(); };
}

if (byId('metal')) {
    const metalEl = byId('metal');
    metalEl.oninput = (e) => {
        const v = parseFloat(e.target.value);
        const out = byId('meto');
        if (out && !isNaN(v)) out.textContent = v.toFixed(2);
        if (S.selected && !isNaN(v) && typeof S.selected.findComponents === 'function') {
            S.selected.findComponents('render').forEach(comp => {
                if (!comp || !comp.meshInstances) return;
                comp.meshInstances.forEach(mi => {
                    if (mi && mi.material) {
                        const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                        mats.forEach(m => {
                            if (m) {
                                m.metalness = v;
                                if (typeof m.update === 'function') m.update();
                            }
                        });
                    }
                });
            });
        }
    };
    metalEl.onchange = () => { if (typeof saveState === 'function') saveState(); };
}

if (byId('animSpin')) {
    byId('animSpin').onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        S.selected._animSpin = !S.selected._animSpin;
        if (typeof saveState === 'function') saveState();
        setToolbarStatus("Auto-Spin: " + (S.selected._animSpin ? "ON" : "OFF"));
    };
}
if (byId('animPulse')) {
    byId('animPulse').onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        S.selected._animPulse = !S.selected._animPulse;
        if (typeof saveState === 'function') saveState();
        setToolbarStatus("Idle Pulse: " + (S.selected._animPulse ? "ON" : "OFF"));
    };
}
if (byId('animWobble')) {
    byId('animWobble').onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        S.selected._animWobble = !S.selected._animWobble;
        if (typeof saveState === 'function') saveState();
        setToolbarStatus("Spring Wobble: " + (S.selected._animWobble ? "ON" : "OFF"));
    };
}

// === PANEL CONTROLS ===
function closeSidePanel(panelId) {
    if (typeof window.__vtfSetPanel === 'function') {
        window.__vtfSetPanel(panelId, false);
        return;
    }
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('mobile-open');
    panel.style.removeProperty('display');
}
window.closeSidePanel = closeSidePanel;

function toggleSidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const isOpen = panel.classList.contains('mobile-open');
    if (typeof window.__vtfSetPanel === 'function') {
        const otherId = panelId === 'left' ? 'right' : 'left';
        if (!isOpen) window.__vtfSetPanel(otherId, false);
        window.__vtfSetPanel(panelId, !isOpen);
        if (!isOpen) panel.scrollTop = 0;
        return;
    }
    panel.style.removeProperty('display');
    const otherId = panelId === 'left' ? 'right' : 'left';
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
if (byId('animSelect')) {
    byId('animSelect').onchange = (e) => {
        if (!S.selected || !Array.isArray(S.selected._animAssets)) return;
        const idx = parseInt(e.target.value, 10);
        if (isNaN(idx) || idx < 0 || idx >= S.selected._animAssets.length) return;
        if (!S.selected.animation) S.selected.addComponent('animation');
        S.selected.animation.asset = S.selected._animAssets[idx];
        S.selected.animation.loop = true;
        const animName = (Array.isArray(S.selected._animNames) && S.selected._animNames[idx]) ? S.selected._animNames[idx] : `Anim_${idx}`;
        setToolbarStatus("Animasi siap: " + animName);
    };
}
if (byId('animPlay')) {
    byId('animPlay').onclick = () => {
        if (S.selected && S.selected.animation && S.selected.animation.asset) {
            S.selected.animation.play();
            setToolbarStatus("▶ Playing: " + (S.selected.animation.asset.name || "Clip"));
        }
    };
}
if (byId('animPause')) {
    byId('animPause').onclick = () => {
        if (S.selected && S.selected.animation) {
            S.selected.animation.pause();
            setToolbarStatus("⏸ Paused");
        }
    };
}
if (byId('animStop')) {
    byId('animStop').onclick = () => {
        if (S.selected && S.selected.animation) {
            S.selected.animation.stop();
            setToolbarStatus("⏹ Stopped");
        }
    };
}

logToolbar("=== toolbar.js DONE ===");
