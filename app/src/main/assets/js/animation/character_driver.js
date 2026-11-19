/* ===== VTuber Forge — js/animation/character_driver.js ===== */
// Character Driver: Procedural animation untuk menggerakkan karakter
// Fitur: Auto-Blink, Breathing, Idle Sway, Head Bob, Walk Cycle

const CharacterDriver = {
    active: false,
    target: null,
    
    // State per-feature
    blink: { enabled: false, nextBlink: 0, interval: 3000, duration: 150 },
    breath: { enabled: false, speed: 1.2, amplitude: 0.02, phase: 0 },
    sway: { enabled: false, speed: 0.8, amplitude: 2, phase: 0 },
    headBob: { enabled: false, speed: 1.5, amplitude: 0.03, phase: 0 },
    walk: { enabled: false, speed: 2, phase: 0, stride: 0.3 },
    
    // Cache bone indices
    _boneCache: {},
    
    /**
     * Attach driver ke karakter yang dipilih
     */
    attach(entity) {
        if (!entity) return alert("Pilih karakter dulu!");
        this.target = entity;
        this._buildBoneCache(entity);
        this.active = true;
        $('status').textContent = "✓ Character driver aktif pada " + entity.name;
        dbg("✅ Character driver attached: " + entity.name);
    },
    
    detach() {
        if (this.target) {
            this._resetPose(this.target);
        }
        this.target = null;
        this.active = false;
        $('status').textContent = "Character driver dinonaktifkan";
    },
    
    /**
     * Cache bone penting untuk performa
     */
    _buildBoneCache(entity) {
        this._boneCache = {};
        const renderComp = entity.findComponent('render');
        if (!renderComp || !renderComp.meshInstances) return;
        
        for (const mi of renderComp.meshInstances) {
            if (!mi.skinInstance || !mi.skinInstance.bones) continue;
            const bones = mi.skinInstance.bones;
            for (const bone of bones) {
                const name = (bone.name || '').toLowerCase();
                if (name.includes('head') && !this._boneCache.head) this._boneCache.head = bone;
                if (name.includes('neck') && !this._boneCache.neck) this._boneCache.neck = bone;
                if (name.includes('spine') && !this._boneCache.spine) this._boneCache.spine = bone;
                if (name.includes('hip') && !this._boneCache.hips) this._boneCache.hips = bone;
                if ((name.includes('l_') || name.includes('left')) && name.includes('leg') && !this._boneCache.legL) this._boneCache.legL = bone;
                if ((name.includes('r_') || name.includes('right')) && name.includes('leg') && !this._boneCache.legR) this._boneCache.legR = bone;
                if ((name.includes('l_') || name.includes('left')) && name.includes('arm') && !this._boneCache.armL) this._boneCache.armL = bone;
                if ((name.includes('r_') || name.includes('right')) && name.includes('arm') && !this._boneCache.armR) this._boneCache.armR = bone;
            }
            break;
        }
        
        // Cache morph indices untuk blink
        if (entity._morphNames) {
            const names = entity._morphNames;
            this._blinkIdxL = names.findIndex(n => /blink.*l|l.*blink|eye.*close.*l/i.test(n));
            this._blinkIdxR = names.findIndex(n => /blink.*r|r.*blink|eye.*close.*r/i.test(n));
            this._breathIdx = names.findIndex(n => /breath|chest|torso/i.test(n));
        }
    },
    
    /**
     * Reset pose ke bind pose
     */
    _resetPose(entity) {
        if (entity._bindPose) {
            const renderComp = entity.findComponent('render');
            if (!renderComp || !renderComp.meshInstances) return;
            for (const mi of renderComp.meshInstances) {
                if (!mi.skinInstance) continue;
                mi.skinInstance.bones.forEach((bone, i) => {
                    const bp = entity._bindPose[i];
                    if (bp) bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
                });
            }
        }
        // Reset morph
        if (entity._morphInstance && this._blinkIdxL >= 0) entity._morphInstance.setWeight(this._blinkIdxL, 0);
        if (entity._morphInstance && this._blinkIdxR >= 0) entity._morphInstance.setWeight(this._blinkIdxR, 0);
    },
    
    /**
     * Update loop — dipanggil setiap frame
     */
    update(dt) {
        if (!this.active || !this.target) return;
        const now = performance.now();
        const entity = this.target;
        
        // === AUTO BLINK ===
        if (this.blink.enabled && entity._morphInstance) {
            if (now > this.blink.nextBlink) {
                // Start blink
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
                    this.blink._blinkStart = null;
                }
                if (this._blinkIdxL >= 0) entity._morphInstance.setWeight(this._blinkIdxL, weight);
                if (this._blinkIdxR >= 0) entity._morphInstance.setWeight(this._blinkIdxR, weight);
            }
        }
        
        // === BREATHING (Chest/Spine) ===
        if (this.breath.enabled) {
            this.breath.phase += dt * this.breath.speed;
            const breathVal = Math.sin(this.breath.phase) * this.breath.amplitude;
            
            // Via bone
            if (this._boneCache.spine) {
                const bp = entity._bindPose ? entity._bindPose[entity._bindPose.indexOf(this._boneCache.spine)] : null;
                if (bp) {
                    this._boneCache.spine.setLocalEulerAngles(
                        bp.x + breathVal * 10,
                        bp.y,
                        bp.z
                    );
                }
            }
            
            // Via morph
            if (this._breathIdx >= 0 && entity._morphInstance) {
                entity._morphInstance.setWeight(this._breathIdx, (breathVal / this.breath.amplitude + 1) * 0.5);
            }
        }
        
        // === IDLE SWAY (Root/Hips) ===
        if (this.sway.enabled) {
            this.sway.phase += dt * this.sway.speed;
            const swayVal = Math.sin(this.sway.phase) * this.sway.amplitude;
            const baseRot = entity._baseRot || entity.getEulerAngles();
            entity.setEulerAngles(baseRot.x, baseRot.y + swayVal, baseRot.z);
        }
        
        // === HEAD BOB ===
        if (this.headBob.enabled && this._boneCache.head) {
            this.headBob.phase += dt * this.headBob.speed;
            const bobVal = Math.sin(this.headBob.phase) * this.headBob.amplitude;
            const headIdx = entity._bindPose ? entity._bindPose.indexOf(this._boneCache.head) : -1;
            if (headIdx >= 0 && entity._bindPose[headIdx]) {
                const bp = entity._bindPose[headIdx];
                this._boneCache.head.setLocalEulerAngles(
                    bp.x + bobVal * 5,
                    bp.y,
                    bp.z + Math.sin(this.headBob.phase * 0.7) * 1
                );
            }
        }
        
        // === WALK CYCLE ===
        if (this.walk.enabled) {
            this.walk.phase += dt * this.walk.speed;
            const legSwing = Math.sin(this.walk.phase) * this.walk.stride * 30;
            
            if (this._boneCache.legL) {
                const idx = entity._bindPose ? entity._bindPose.indexOf(this._boneCache.legL) : -1;
                if (idx >= 0 && entity._bindPose[idx]) {
                    const bp = entity._bindPose[idx];
                    this._boneCache.legL.setLocalEulerAngles(bp.x + legSwing, bp.y, bp.z);
                }
            }
            if (this._boneCache.legR) {
                const idx = entity._bindPose ? entity._bindPose.indexOf(this._boneCache.legR) : -1;
                if (idx >= 0 && entity._bindPose[idx]) {
                    const bp = entity._bindPose[idx];
                    this._boneCache.legR.setLocalEulerAngles(bp.x - legSwing, bp.y, bp.z);
                }
            }
            if (this._boneCache.armL) {
                const idx = entity._bindPose ? entity._bindPose.indexOf(this._boneCache.armL) : -1;
                if (idx >= 0 && entity._bindPose[idx]) {
                    const bp = entity._bindPose[idx];
                    this._boneCache.armL.setLocalEulerAngles(bp.x - legSwing * 0.7, bp.y, bp.z);
                }
            }
            if (this._boneCache.armR) {
                const idx = entity._bindPose ? entity._bindPose.indexOf(this._boneCache.armR) : -1;
                if (idx >= 0 && entity._bindPose[idx]) {
                    const bp = entity._bindPose[idx];
                    this._boneCache.armR.setLocalEulerAngles(bp.x + legSwing * 0.7, bp.y, bp.z);
                }
            }
        }
    }
};

// Hook ke render loop
const _origUpdate = app.update.bind(app);
app.on('update', (dt) => {
    if (typeof CharacterDriver !== 'undefined') {
        CharacterDriver.update(dt);
    }
});

// === UI BINDINGS ===
function setupCharacterDriverUI() {
    const panel = $('charDriverPanel');
    if (!panel) return;
    
    // Toggle panel
    if ($('btnCharDriver')) {
        $('btnCharDriver').onclick = () => {
            if (!S.selected) return alert("Pilih karakter dulu!");
            const renderComp = S.selected.findComponent('render');
            if (!renderComp || !renderComp.meshInstances) return alert("Objek tidak punya mesh!");
            
            const hasSkeleton = renderComp.meshInstances.some(mi => mi.skinInstance != null);
            const hasMorph = S.selected._morphInstance && S.selected._morphNames && S.selected._morphNames.length > 0;
            
            if (!hasSkeleton && !hasMorph) {
                return alert("Karakter butuh skeleton atau blendshapes untuk driver animasi.\n\nImport model VRM/GLB yang punya tulang/blendshapes.");
            }
            
            CharacterDriver.attach(S.selected);
            panel.style.display = 'block';
        };
    }
    
    if ($('btnDetachDriver')) {
        $('btnDetachDriver').onclick = () => {
            CharacterDriver.detach();
            panel.style.display = 'none';
        };
    }
    
    // Blink toggle
    if ($('toggleBlink')) {
        $('toggleBlink').onchange = (e) => {
            CharacterDriver.blink.enabled = e.target.checked;
            if (e.target.checked && !CharacterDriver.active && S.selected) {
                CharacterDriver.attach(S.selected);
            }
        };
    }
    
    // Breath
    if ($('toggleBreath')) {
        $('toggleBreath').onchange = (e) => {
            CharacterDriver.breath.enabled = e.target.checked;
            if (e.target.checked && !CharacterDriver.active && S.selected) {
                CharacterDriver.attach(S.selected);
            }
        };
    }
    if ($('breathSpeed')) {
        $('breathSpeed').oninput = (e) => {
            CharacterDriver.breath.speed = parseFloat(e.target.value);
            $('breathSpeedOut').textContent = parseFloat(e.target.value).toFixed(1);
        };
    }
    
    // Sway
    if ($('toggleSway')) {
        $('toggleSway').onchange = (e) => {
            CharacterDriver.sway.enabled = e.target.checked;
            if (e.target.checked && !CharacterDriver.active && S.selected) {
                CharacterDriver.attach(S.selected);
            }
        };
    }
    if ($('swayAmount')) {
        $('swayAmount').oninput = (e) => {
            CharacterDriver.sway.amplitude = parseFloat(e.target.value);
            $('swayAmountOut').textContent = parseFloat(e.target.value).toFixed(1);
        };
    }
    
    // Head bob
    if ($('toggleHeadBob')) {
        $('toggleHeadBob').onchange = (e) => {
            CharacterDriver.headBob.enabled = e.target.checked;
            if (e.target.checked && !CharacterDriver.active && S.selected) {
                CharacterDriver.attach(S.selected);
            }
        };
    }
    
    // Walk cycle
    if ($('toggleWalk')) {
        $('toggleWalk').onchange = (e) => {
            CharacterDriver.walk.enabled = e.target.checked;
            if (e.target.checked && !CharacterDriver.active && S.selected) {
                CharacterDriver.attach(S.selected);
            }
        };
    }
    if ($('walkSpeed')) {
        $('walkSpeed').oninput = (e) => {
            CharacterDriver.walk.speed = parseFloat(e.target.value);
            $('walkSpeedOut').textContent = parseFloat(e.target.value).toFixed(1);
        };
    }
    
    // Reset pose
    if ($('resetDriverPose')) {
        $('resetDriverPose').onclick = () => {
            if (CharacterDriver.target) {
                CharacterDriver._resetPose(CharacterDriver.target);
                $('status').textContent = "Pose di-reset ke bind pose";
            }
        };
    }
}

// Init saat DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCharacterDriverUI);
} else {
    setupCharacterDriverUI();
}

dbg("✅ character_driver.js loaded");
