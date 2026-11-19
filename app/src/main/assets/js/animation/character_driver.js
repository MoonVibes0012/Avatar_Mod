/* ===== VTuber Forge — js/animation/character_driver.js ===== */
/* Character Driver: Procedural animation untuk menggerakkan karakter */
/* Fitur: Auto-Blink, Breathing, Idle Sway, Head Bob, Walk Cycle */
/* FULL REPLACE — fix: indexOf bindPose, sway drift, mesh break, */
/* toggle-off reset, blink index stale, panel kanan, guard global */

(function () {
'use strict';

// ---------- helpers aman (gak ngandelin global $ / dbg / S / app) ----------
function $(id) { return document.getElementById(id); }
function setStatus(msg) {
    const el = $('status');
    if (el) el.textContent = msg;
}
function dbgLog(msg) {
    if (typeof window.dbg === 'function') { try { window.dbg(msg); } catch (e) {} }
    else if (typeof console !== 'undefined') { console.log(msg); }
}
function getSelected() {
    if (typeof window.S !== 'undefined' && window.S) return window.S.selected || null;
    return null;
}
function getApp() {
    if (typeof window.app !== 'undefined' && window.app) return window.app;
    return null;
}

const CharacterDriver = {
    active: false,
    target: null,

    // State per-feature
    blink: { enabled: false, nextBlink: 0, interval: 3000, duration: 150, _blinkStart: 0 },
    breath: { enabled: false, speed: 1.2, amplitude: 0.02, phase: 0 },
    sway: { enabled: false, speed: 0.8, amplitude: 2, phase: 0 },
    headBob: { enabled: false, speed: 1.5, amplitude: 0.03, phase: 0 },
    walk: { enabled: false, speed: 2, phase: 0, stride: 0.3 },

    // Cache bone + index-nya (index sejajar dengan skinInstance.bones)
    _boneCache: {}, // { head, headIdx, neck, neckIdx, spine, spineIdx, hips, hipsIdx, legL, legLIdx, ... }
    _blinkIdxL: -1,
    _blinkIdxR: -1,
    _breathIdx: -1,
    _baseRot: null, // Euler base untuk sway, di-cache sekali di attach()
    _baseBones: null, // Map bone -> {x,y,z} bind pose, supaya reset & animasi akurat
    _morphNames: null,

    attach(entity) {
        if (!entity) { alert("Pilih karakter dulu!"); return; }
        // Detach dulu dari karakter lama supaya pose lama ke-reset
        if (this.target && this.target !== entity) this.detach();

        this.target = entity;
        this._buildBoneCache(entity);
        this._buildBindPose(entity);
        // Cache rotasi base untuk sway — SEKALI di sini, bukan tiap frame
        try {
            const e = entity.getEulerAngles();
            this._baseRot = { x: e.x, y: e.y, z: e.z };
        } catch (err) { this._baseRot = { x: 0, y: 0, z: 0 }; }
        // Reset phase supaya gak loncat pas attach ulang
        this.blink._blinkStart = 0;
        this.blink.nextBlink = performance.now() + 500;
        this.breath.phase = 0;
        this.sway.phase = 0;
        this.headBob.phase = 0;
        this.walk.phase = 0;

        this.active = true;
        setStatus("✓ Character driver aktif pada " + (entity.name || "karakter"));
        dbgLog("✅ Character driver attached: " + (entity.name || ""));
    },

    detach() {
        if (this.target) {
            this._resetPose(this.target);
            // Balikin rotasi root ke base (sway nulis ke entity, bukan bone)
            if (this._baseRot) {
                try { this.target.setEulerAngles(this._baseRot.x, this._baseRot.y, this._baseRot.z); } catch (e) {}
            }
        }
        this.target = null;
        this.active = false;
        this._baseRot = null;
        this._baseBones = null;
        this._boneCache = {};
        this._blinkIdxL = -1;
        this._blinkIdxR = -1;
        this._breathIdx = -1;
        setStatus("Character driver dinonaktifkan");
    },

    /* Cache bone penting + INDEX-nya. Loop SEMUA mesh, jangan break. */
    _buildBoneCache(entity) {
        this._boneCache = {};
        this._blinkIdxL = -1;
        this._blinkIdxR = -1;
        this._breathIdx = -1;
        this._morphNames = entity._morphNames || null;

        const renderComp = entity.findComponent ? entity.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances) return;

        const pick = (key, bone, idx) => {
            if (!this._boneCache[key]) {
                this._boneCache[key] = bone;
                this._boneCache[key + 'Idx'] = idx;
            }
        };

        for (const mi of renderComp.meshInstances) {
            if (!mi.skinInstance || !mi.skinInstance.bones) continue;
            const bones = mi.skinInstance.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                const name = (bone.name || '').toLowerCase();
                // Urutan penting: cek yang spesifik dulu biar gak salah ambil
                // head: "head" tapi bukan "headphones" dll — cukup includes, VRM/GLB konsisten
                if (name.includes('head')) pick('head', bone, i);
                else if (name.includes('neck')) pick('neck', bone, i);
                // spine: spine, spine1, spine2, chest
                else if (name.includes('spine') || name === 'chest' || name.includes('chest')) pick('spine', bone, i);
                else if (name.includes('hip') || name.includes('pelvis') || name === 'hips') pick('hips', bone, i);
                // Kaki: upperleg / lowerleg / leg — cek kiri/kanan
                else if (name.includes('leg')) {
                    if ((name.includes('l_') || name.startsWith('l') || name.includes('left')) && !name.includes('right')) pick('legL', bone, i);
                    else if ((name.includes('r_') || name.startsWith('r') || name.includes('right')) && !name.includes('left')) pick('legR', bone, i);
                    // fallback: kalau cuma ada 1 leg dan belum keisi, isi legL dulu
                    else if (!this._boneCache.legL) pick('legL', bone, i);
                }
                // Tangan: upperarm / lowerarm / arm / hand (pakai arm aja)
                else if (name.includes('arm')) {
                    if ((name.includes('l_') || name.startsWith('l') || name.includes('left')) && !name.includes('right')) pick('armL', bone, i);
                    else if ((name.includes('r_') || name.startsWith('r') || name.includes('right')) && !name.includes('left')) pick('armR', bone, i);
                    else if (!this._boneCache.armL) pick('armL', bone, i);
                }
            }
            // JANGAN break — skeleton bisa kebagi di banyak mesh.
            // pick() di atas udah jaga biar yang pertama menang.
        }

        // Cache morph indices untuk blink — reset dulu, jangan pakai sisa karakter lama
        if (entity._morphNames && entity._morphNames.length) {
            const names = entity._morphNames;
            // Cari yang paling spesifik: blink + left/right, jangan regex longgar
            const findBlink = (side) => {
                const s = side; // 'l' atau 'r'
                // 1. blink + side, misal blink_l, blinkLeft, eyeBlink_L
                let idx = names.findIndex(n => /blink/i.test(n) && new RegExp('[_.\\- ]?' + s + '(eft|ight)?$', 'i').test(n));
                if (idx >= 0) return idx;
                // 2. side + blink, misal leftBlink, lBlink
                idx = names.findIndex(n => new RegExp('^' + s + '[_.\\-]?blink', 'i').test(n) || new RegExp('left[_.\\-]?blink|right[_.\\-]?blink', 'i').test(n) && (s === 'l' ? /left/i.test(n) : /right/i.test(n)));
                if (idx >= 0) return idx;
                // 3. eye close + side
                idx = names.findIndex(n => /eye.*close/i.test(n) && (s === 'l' ? /left|\bl\b|_l$/i.test(n) : /right|\br\b|_r$/i.test(n)));
                if (idx >= 0) return idx;
                return -1;
            };
            this._blinkIdxL = findBlink('l');
            this._blinkIdxR = findBlink('r');
            // Kalau cuma ada 1 blink (tanpa L/R), pakai untuk dua mata
            if (this._blinkIdxL < 0 && this._blinkIdxR < 0) {
                const both = names.findIndex(n => /blink/i.test(n));
                if (both >= 0) { this._blinkIdxL = both; this._blinkIdxR = both; }
            } else if (this._blinkIdxL < 0) this._blinkIdxL = this._blinkIdxR;
            else if (this._blinkIdxR < 0) this._blinkIdxR = this._blinkIdxL;

            this._breathIdx = names.findIndex(n => /breath|chest|torso/i.test(n));
        }
    },

    /* Bangun bind pose sejajar bones per-mesh, supaya reset akurat.
       Simpan per-bone (bukan per-index global) karena tiap mesh bisa beda urutan. */
    _buildBindPose(entity) {
        this._baseBones = new Map();
        // Kalau entity udah punya _bindPose dari import.js / bone.js dan bentuknya
        // array sejajar bones mesh pertama, tetap pakai itu sebagai fallback.
        // Di sini kita ambil pose SAAT INI sebagai bind pose kalau belum ada.
        // Catatan: attach sebaiknya dipanggil saat karakter di pose netral.
        const renderComp = entity.findComponent ? entity.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances) return;
        for (const mi of renderComp.meshInstances) {
            if (!mi.skinInstance || !mi.skinInstance.bones) continue;
            for (const bone of mi.skinInstance.bones) {
                if (this._baseBones.has(bone)) continue;
                try {
                    const e = bone.getLocalEulerAngles ? bone.getLocalEulerAngles() : bone.getEulerAngles();
                    this._baseBones.set(bone, { x: e.x, y: e.y, z: e.z });
                } catch (err) {}
            }
        }
        // Fallback ke entity._bindPose kalau ada (format lama: array Vec3 sejajar bones mesh pertama)
        if (this._baseBones.size === 0 && entity._bindPose && entity._bindPose.length) {
            const first = renderComp.meshInstances[0];
            if (first && first.skinInstance && first.skinInstance.bones) {
                first.skinInstance.bones.forEach((bone, i) => {
                    const bp = entity._bindPose[i];
                    if (bp) this._baseBones.set(bone, { x: bp.x, y: bp.y, z: bp.z });
                });
            }
        }
    },

    _getBase(bone) {
        if (this._baseBones && this._baseBones.has(bone)) return this._baseBones.get(bone);
        return { x: 0, y: 0, z: 0 };
    },

    /* Reset pose ke bind pose + morph ke 0 */
    _resetPose(entity) {
        const renderComp = entity.findComponent ? entity.findComponent('render') : null;
        if (renderComp && renderComp.meshInstances) {
            for (const mi of renderComp.meshInstances) {
                if (!mi.skinInstance || !mi.skinInstance.bones) continue;
                mi.skinInstance.bones.forEach((bone) => {
                    const bp = this._getBase(bone);
                    try { bone.setLocalEulerAngles(bp.x, bp.y, bp.z); } catch (e) {}
                });
            }
        } else if (entity._bindPose) {
            // Fallback format lama
            if (renderComp && renderComp.meshInstances) {
                for (const mi of renderComp.meshInstances) {
                    if (!mi.skinInstance) continue;
                    mi.skinInstance.bones.forEach((bone, i) => {
                        const bp = entity._bindPose[i];
                        if (bp) { try { bone.setLocalEulerAngles(bp.x, bp.y, bp.z); } catch (e) {} }
                    });
                }
            }
        }
        // Reset morph — blink + breath, bukan cuma blink
        if (entity._morphInstance) {
            try {
                if (this._blinkIdxL >= 0) entity._morphInstance.setWeight(this._blinkIdxL, 0);
                if (this._blinkIdxR >= 0 && this._blinkIdxR !== this._blinkIdxL) entity._morphInstance.setWeight(this._blinkIdxR, 0);
                if (this._breathIdx >= 0) entity._morphInstance.setWeight(this._breathIdx, 0);
            } catch (e) {}
        }
        this.blink._blinkStart = 0;
    },

    /* Reset SATU fitur aja (dipakai pas toggle OFF) */
    _resetFeature(feature) {
        if (!this.target) return;
        const entity = this.target;
        if (feature === 'blink') {
            this.blink._blinkStart = 0;
            if (entity._morphInstance) {
                try {
                    if (this._blinkIdxL >= 0) entity._morphInstance.setWeight(this._blinkIdxL, 0);
                    if (this._blinkIdxR >= 0 && this._blinkIdxR !== this._blinkIdxL) entity._morphInstance.setWeight(this._blinkIdxR, 0);
                } catch (e) {}
            }
        }
        if (feature === 'breath') {
            if (this._boneCache.spine) {
                const bp = this._getBase(this._boneCache.spine);
                try { this._boneCache.spine.setLocalEulerAngles(bp.x, bp.y, bp.z); } catch (e) {}
            }
            if (entity._morphInstance && this._breathIdx >= 0) {
                try { entity._morphInstance.setWeight(this._breathIdx, 0); } catch (e) {}
            }
        }
        if (feature === 'sway') {
            if (this._baseRot) { try { entity.setEulerAngles(this._baseRot.x, this._baseRot.y, this._baseRot.z); } catch (e) {} }
        }
        if (feature === 'headBob') {
            if (this._boneCache.head) {
                const bp = this._getBase(this._boneCache.head);
                try { this._boneCache.head.setLocalEulerAngles(bp.x, bp.y, bp.z); } catch (e) {}
            }
        }
        if (feature === 'walk') {
            ['legL', 'legR', 'armL', 'armR'].forEach(k => {
                const bone = this._boneCache[k];
                if (!bone) return;
                const bp = this._getBase(bone);
                try { bone.setLocalEulerAngles(bp.x, bp.y, bp.z); } catch (e) {}
            });
        }
    },

    update(dt) {
        if (!this.active || !this.target) return;
        if (!dt || dt <= 0) dt = 0.016;
        // Clamp dt biar gak loncat pas tab di-background
        if (dt > 0.05) dt = 0.05;
        const now = performance.now();
        const entity = this.target;

        // === AUTO BLINK ===
        if (this.blink.enabled && entity._morphInstance && (this._blinkIdxL >= 0 || this._blinkIdxR >= 0)) {
            if (now > this.blink.nextBlink) {
                this.blink._blinkStart = now;
                this.blink.nextBlink = now + this.blink.interval + Math.random() * 2000;
            }
            if (this.blink._blinkStart) {
                const elapsed = now - this.blink._blinkStart;
                let weight = 0;
                if (elapsed < this.blink.duration / 2) {
                    weight = elapsed / (this.blink.duration / 2);
                } else if (elapsed < this.blink.duration) {
                    weight = 1 - (elapsed - this.blink.duration / 2) / (this.blink.duration / 2);
                } else {
                    this.blink._blinkStart = 0;
                    weight = 0;
                }
                try {
                    if (this._blinkIdxL >= 0) entity._morphInstance.setWeight(this._blinkIdxL, weight);
                    if (this._blinkIdxR >= 0 && this._blinkIdxR !== this._blinkIdxL) entity._morphInstance.setWeight(this._blinkIdxR, weight);
                } catch (e) {}
            }
        }

        // === BREATHING (Chest/Spine) ===
        if (this.breath.enabled) {
            this.breath.phase += dt * this.breath.speed;
            const breathVal = Math.sin(this.breath.phase) * this.breath.amplitude;
            // Via bone — pakai index yang udah di-cache, bukan indexOf(_bindPose)
            if (this._boneCache.spine) {
                const bp = this._getBase(this._boneCache.spine);
                // Multiplier dibesarin: 0.02 * 10 = 0.2° itu gak keliatan.
                // 0.02 * 40 = 0.8° baru kerasa napas.
                this._boneCache.spine.setLocalEulerAngles(bp.x + breathVal * 40, bp.y, bp.z);
            }
            // Via morph
            if (this._breathIdx >= 0 && entity._morphInstance) {
                const amp = this.breath.amplitude || 0.02;
                try { entity._morphInstance.setWeight(this._breathIdx, (breathVal / amp + 1) * 0.5); } catch (e) {}
            }
        }

        // === IDLE SWAY (Root/Hips) ===
        if (this.sway.enabled) {
            this.sway.phase += dt * this.sway.speed;
            const swayVal = Math.sin(this.sway.phase) * this.sway.amplitude;
            // Pakai _baseRot yang di-cache di attach(), bukan getEulerAngles() tiap frame
            const base = this._baseRot || { x: 0, y: 0, z: 0 };
            entity.setEulerAngles(base.x, base.y + swayVal, base.z);
        }

        // === HEAD BOB ===
        if (this.headBob.enabled && this._boneCache.head) {
            this.headBob.phase += dt * this.headBob.speed;
            const bobVal = Math.sin(this.headBob.phase) * this.headBob.amplitude;
            const bp = this._getBase(this._boneCache.head);
            // Multiplier dibesarin: 0.03 * 5 = 0.15° gak keliatan. 0.03 * 40 = 1.2° baru kerasa.
            this._boneCache.head.setLocalEulerAngles(
                bp.x + bobVal * 40,
                bp.y,
                bp.z + Math.sin(this.headBob.phase * 0.7) * 1
            );
        }

        // === WALK CYCLE ===
        if (this.walk.enabled) {
            this.walk.phase += dt * this.walk.speed;
            const legSwing = Math.sin(this.walk.phase) * this.walk.stride * 30;

            const apply = (key, swing) => {
                const bone = this._boneCache[key];
                if (!bone) return;
                const bp = this._getBase(bone);
                bone.setLocalEulerAngles(bp.x + swing, bp.y, bp.z);
            };
            apply('legL', legSwing);
            apply('legR', -legSwing);
            apply('armL', -legSwing * 0.7);
            apply('armR', legSwing * 0.7);
        }
    }
};

// Expose ke window biar bisa dipanggil file lain
window.CharacterDriver = CharacterDriver;

// Hook ke render loop — guard, jangan crash kalau app belum ada
function hookUpdate() {
    const app = getApp();
    if (app && typeof app.on === 'function') {
        app.on('update', (dt) => { CharacterDriver.update(dt); });
        return true;
    }
    return false;
}
if (!hookUpdate()) {
    // app belum dibuat (init.js async) — coba lagi sebentar
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        if (hookUpdate() || tries > 50) clearInterval(timer);
    }, 100);
}

// === UI BINDINGS ===
function setupCharacterDriverUI() {
    const panel = $('charDriverPanel');
    if (!panel) return;

    const openRightPanel = () => {
        const right = $('right');
        if (right) right.classList.add('mobile-open');
    };
    const ensureAttached = () => {
        const sel = getSelected();
        if (!sel) { alert("Pilih karakter dulu!"); return false; }
        if (!CharacterDriver.active || CharacterDriver.target !== sel) CharacterDriver.attach(sel);
        return true;
    };

    if ($('btnCharDriver')) {
        $('btnCharDriver').onclick = () => {
            const sel = getSelected();
            if (!sel) return alert("Pilih karakter dulu!");
            const renderComp = sel.findComponent ? sel.findComponent('render') : null;
            if (!renderComp || !renderComp.meshInstances) return alert("Objek tidak punya mesh!");

            const hasSkeleton = renderComp.meshInstances.some(mi => mi.skinInstance != null);
            const hasMorph = sel._morphInstance && sel._morphNames && sel._morphNames.length > 0;

            if (!hasSkeleton && !hasMorph) {
                return alert("Karakter butuh skeleton atau blendshapes untuk driver animasi.\n\nImport model VRM/GLB yang punya tulang/blendshapes.");
            }
            CharacterDriver.attach(sel);
            // FIX: buka panel kanan dulu, baru section-nya.
            // Kalau enggak, panel driver gak keliatan karena parent #right masih display:none
            openRightPanel();
            panel.style.display = 'block';
        };
    }

    if ($('btnDetachDriver')) {
        $('btnDetachDriver').onclick = () => {
            CharacterDriver.detach();
            panel.style.display = 'none';
        };
    }

    const bindToggle = (id, feature) => {
        const el = $(id);
        if (!el) return;
        el.onchange = (e) => {
            const on = e.target.checked;
            CharacterDriver[feature].enabled = on;
            if (on) {
                if (!ensureAttached()) { e.target.checked = false; CharacterDriver[feature].enabled = false; return; }
            } else {
                // FIX: toggle OFF langsung balikin pose fitur itu, jangan dibiarin nyangkut
                CharacterDriver._resetFeature(feature);
            }
        };
    };
    bindToggle('toggleBlink', 'blink');
    bindToggle('toggleBreath', 'breath');
    bindToggle('toggleSway', 'sway');
    bindToggle('toggleHeadBob', 'headBob');
    bindToggle('toggleWalk', 'walk');

    const bindSlider = (id, outId, feature, key) => {
        const el = $(id);
        if (!el) return;
        el.oninput = (e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) CharacterDriver[feature][key] = v;
            const out = $(outId);
            if (out) out.textContent = isNaN(v) ? '' : v.toFixed(1);
        };
    };
    bindSlider('breathSpeed', 'breathSpeedOut', 'breath', 'speed');
    bindSlider('swayAmount', 'swayAmountOut', 'sway', 'amplitude');
    bindSlider('walkSpeed', 'walkSpeedOut', 'walk', 'speed');

    if ($('resetDriverPose')) {
        $('resetDriverPose').onclick = () => {
            if (CharacterDriver.target) {
                CharacterDriver._resetPose(CharacterDriver.target);
                setStatus("Pose di-reset ke bind pose");
            }
        };
    }
}

// Init saat DOM ready — script ini di akhir body, jadi biasanya langsung jalan
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCharacterDriverUI);
} else {
    setupCharacterDriverUI();
}

dbgLog("✅ character_driver.js loaded");
})();
