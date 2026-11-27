/* ===== VTuber Forge — js/animation/character_driver.js ===== */
// Character Driver: Animasi procedural (Auto-Blink multi-mesh/VRM, Breathing, Idle Sway, Head Bob, Walk Cycle)
// Mendukung rig multi-render VRM/GLB & bind pose awal anti-drift

(function () {
    'use strict';

    let driverEnabled = false;
    let blinkEnabled = false;
    let breathEnabled = false;
    let swayEnabled = false;
    let headBobEnabled = false;
    let walkEnabled = false;

    let breathSpeed = 1.2;
    let swayAmount = 2.0;
    let walkSpeed = 2.0;

    let driverTime = 0;
    let nextBlinkTime = 2.5;
    let isBlinking = false;
    let blinkProgress = 0;

    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            return null;
        }
    }

    function setDriverStatus(msg) {
        try {
            const el = byId('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    function logDriver(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getDriverApp() {
        if (typeof window.getPcApp === 'function') {
            try {
                const pcApp = window.getPcApp();
                if (pcApp) return pcApp;
            } catch (e) {}
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    function getSelectedObj() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    function getRigForDriver(entity) {
        if (!entity) return { hasSkinned: false, bones: [], bindPose: [] };
        if (typeof window.collectRigFromEntity === 'function') {
            return window.collectRigFromEntity(entity, false);
        }
        const renders = typeof entity.findComponents === 'function'
            ? (entity.findComponents('render') || [])
            : (entity.render ? [entity.render] : []);
        const seen = new Set();
        const bones = [];
        renders.forEach((rc) => {
            if (!rc || !Array.isArray(rc.meshInstances)) return;
            rc.meshInstances.forEach((mi) => {
                if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                    mi.skinInstance.bones.forEach((b) => {
                        if (b && !seen.has(b)) {
                            seen.add(b);
                            bones.push(b);
                        }
                    });
                }
            });
        });

        if (bones.length > 0 && (!Array.isArray(entity._bindPose) || entity._bindPose.length !== bones.length)) {
            entity._bindPose = bones.map((b) => {
                const r = b.getLocalEulerAngles ? b.getLocalEulerAngles() : { x: 0, y: 0, z: 0 };
                return { x: Number(r.x) || 0, y: Number(r.y) || 0, z: Number(r.z) || 0 };
            });
        }

        return {
            hasSkinned: bones.length > 0,
            bones: bones,
            bindPose: entity._bindPose || []
        };
    }

    function setActiveDriverFlag(entity, active) {
        if (entity && typeof entity === 'object') {
            entity._driverActive = !!active;
        }
    }

    function updateDriverButtonState() {
        const btn = byId('btnCharDriver');
        if (btn) btn.classList.toggle('active', !!driverEnabled);
    }

    function toggleCharDriverPanel() {
        const panel = byId('charDriverPanel');
        if (!panel) return;
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            const selected = getSelectedObj();
            if (selected) getRigForDriver(selected);
            driverEnabled = true;
            setActiveDriverFlag(selected, true);
            updateDriverButtonState();
            setDriverStatus("🎭 Character Driver aktif — atur animasi procedural");
        }
    }

    function attachDriverToSelected() {
        const selected = getSelectedObj();
        if (!selected) {
            setDriverStatus("⚠ Pilih model VRM/GLB dulu!");
            return false;
        }
        const rig = getRigForDriver(selected);
        driverEnabled = true;
        setActiveDriverFlag(selected, true);
        updateDriverButtonState();
        const panel = byId('charDriverPanel');
        if (panel) panel.style.display = 'block';
        setDriverStatus("🎭 Driver aktif pada: " + (selected.name || "Objek") + " (" + rig.bones.length + " bone)");
        logDriver("✅ Character driver attached to " + (selected.name || "Objek"));
        return true;
    }

    function detachDriver() {
        const currentSelected = getSelectedObj();
        driverEnabled = false;
        blinkEnabled = false;
        breathEnabled = false;
        swayEnabled = false;
        headBobEnabled = false;
        walkEnabled = false;

        if (typeof window.S !== 'undefined' && window.S && Array.isArray(window.S.objects)) {
            window.S.objects.forEach(o => setActiveDriverFlag(o, false));
        }
        setActiveDriverFlag(currentSelected, false);

        const cbBlink = byId('toggleBlink'); if (cbBlink) cbBlink.checked = false;
        const cbBreath = byId('toggleBreath'); if (cbBreath) cbBreath.checked = false;
        const cbSway = byId('toggleSway'); if (cbSway) cbSway.checked = false;
        const cbBob = byId('toggleHeadBob'); if (cbBob) cbBob.checked = false;
        const cbWalk = byId('toggleWalk'); if (cbWalk) cbWalk.checked = false;

        updateDriverButtonState();
        const panel = byId('charDriverPanel');
        if (panel) panel.style.display = 'none';
        resetDriverPose();
        setDriverStatus("🎭 Character Driver dilepas");
        logDriver("⏹ Character driver detached");
    }

    function resetDriverPose() {
        const selected = getSelectedObj();
        if (!selected) return;

        try {
            if (selected._baseScale && typeof selected.setLocalScale === 'function') {
                selected.setLocalScale(selected._baseScale.x, selected._baseScale.y, selected._baseScale.z);
            }
            if (selected._baseRot && typeof selected.setEulerAngles === 'function') {
                selected.setEulerAngles(selected._baseRot.x, selected._baseRot.y, selected._baseRot.z);
            }
            const rig = getRigForDriver(selected);
            if (rig.hasSkinned && Array.isArray(rig.bindPose)) {
                rig.bones.forEach((bone, idx) => {
                    const bp = rig.bindPose[idx];
                    if (bp && bone) {
                        if (typeof bone.setLocalEulerAngles === 'function') {
                            bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
                        }
                        if (typeof bone.setLocalScale === 'function' && bp.sx !== undefined) {
                            bone.setLocalScale(bp.sx, bp.sy, bp.sz);
                        }
                    }
                });
            }
        } catch (e) {
            logDriver("Reset pose error: " + e.message);
        }
        setDriverStatus("Pose di-reset ke bind pose");
    }

    /**
     * Menerapkan bobot kedip (0..1) menggunakan binding ekspresi VRM (blink/blinkLeft/blinkRight)
     * atau fallback seluruh slot morph target lintas mesh yang mengandung kata kunci blink.
     */
    function applyBlinkWeightToModel(entity, weight) {
        if (!entity) return;
        const w = Math.max(0, Math.min(1, Number(weight) || 0));
        const vrmExpr = (entity._vrmExpressions && typeof entity._vrmExpressions === 'object')
            ? entity._vrmExpressions
            : {};

        let applied = false;
        const blinkKeys = ['blink', 'blinkLeft', 'blinkRight'];
        for (let k = 0; k < blinkKeys.length; k++) {
            const def = vrmExpr[blinkKeys[k]];
            if (def && Array.isArray(def.binds) && def.binds.length > 0) {
                def.binds.forEach((b) => {
                    try {
                        if (b.morphInstance && typeof b.morphInstance.setWeight === 'function') {
                            const maxW = b.weight !== undefined ? b.weight : 1.0;
                            b.morphInstance.setWeight(b.targetIndex, w * maxW);
                            applied = true;
                        }
                    } catch (e) {}
                });
            }
        }

        const slots = Array.isArray(entity._morphSlots)
            ? entity._morphSlots
            : (entity._morphInstance && Array.isArray(entity._morphNames)
                ? entity._morphNames.map((n, idx) => ({ morphInstance: entity._morphInstance, targetIndex: idx, targetName: n }))
                : []);

        slots.forEach((slot, sIdx) => {
            const lower = String(slot.targetName || '').toLowerCase();
            const isBlinkName = lower.includes('blink') || lower.includes('eye_close') || lower.includes('eyeclose');
            if (!applied && isBlinkName && slot.morphInstance && typeof slot.morphInstance.setWeight === 'function') {
                try {
                    slot.morphInstance.setWeight(slot.targetIndex, w);
                } catch (e) {}
            }
            if (isBlinkName || applied) {
                try {
                    const curW = (slot.morphInstance && typeof slot.morphInstance.getWeight === 'function')
                        ? Number(slot.morphInstance.getWeight(slot.targetIndex))
                        : 0;
                    if (isFinite(curW)) {
                        const slider = document.querySelector('#morphControls input[data-morph-idx="' + sIdx + '"]');
                        if (slider) slider.value = curW.toFixed(2);
                        const label = byId('morphVal_' + sIdx);
                        if (label) label.textContent = curW.toFixed(2);
                    }
                } catch (e) {}
            }
        });
    }

    function findBoneIndexByKeywords(bones, keywords) {
        if (!Array.isArray(bones)) return -1;
        return bones.findIndex(b => {
            const name = ((b && b.name) || '').toLowerCase();
            return keywords.some(kw => name.includes(kw));
        });
    }

    function getBindRot(bindPose, boneIndex, fallbackEuler) {
        if (Array.isArray(bindPose) && bindPose[boneIndex]) {
            const bp = bindPose[boneIndex];
            return {
                x: Number(bp.x) || 0,
                y: Number(bp.y) || 0,
                z: Number(bp.z) || 0
            };
        }
        return {
            x: (fallbackEuler && Number(fallbackEuler.x)) || 0,
            y: (fallbackEuler && Number(fallbackEuler.y)) || 0,
            z: (fallbackEuler && Number(fallbackEuler.z)) || 0
        };
    }

    function updateProceduralAnimation(dt) {
        const selected = getSelectedObj();
        if (!selected) return;

        setActiveDriverFlag(selected, true);

        const safeDt = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? Math.min(dt, 0.1) : 0.016;
        driverTime += safeDt;

        // 1. Auto-Blink (Multi-Mesh & VRM Expression Binding)
        if (blinkEnabled) {
            if (!isBlinking) {
                nextBlinkTime -= safeDt;
                if (nextBlinkTime <= 0) {
                    isBlinking = true;
                    blinkProgress = 0;
                    nextBlinkTime = 2.2 + Math.random() * 3.0;
                }
            } else {
                blinkProgress += safeDt * 6.5;
                let weight = 0;
                if (blinkProgress < 0.5) {
                    weight = Math.min(1, blinkProgress * 2);
                } else if (blinkProgress < 1.0) {
                    weight = Math.max(0, (1.0 - blinkProgress) * 2);
                } else {
                    isBlinking = false;
                    weight = 0;
                }
                applyBlinkWeightToModel(selected, weight);
            }
        }

        const rig = getRigForDriver(selected);
        const bones = rig.hasSkinned ? rig.bones : null;
        const bindPose = rig.bindPose;

        // 2. Breathing
        if (breathEnabled) {
            const phase = driverTime * breathSpeed * Math.PI * 2;
            const breathVal = Math.sin(phase) * 0.015;
            if (bones) {
                const chestIdx = findBoneIndexByKeywords(bones, ['chest', 'spine', 'upperchest']);
                const chestBone = chestIdx >= 0 ? bones[chestIdx] : null;
                if (chestBone && typeof chestBone.setLocalScale === 'function') {
                    const bp = bindPose[chestIdx] || { sx: 1, sy: 1, sz: 1 };
                    chestBone.setLocalScale(
                        (bp.sx || 1) * (1 + breathVal),
                        (bp.sy || 1) * (1 + breathVal * 0.6),
                        (bp.sz || 1) * (1 + breathVal)
                    );
                }
            } else if (selected._baseScale && typeof selected.setLocalScale === 'function') {
                selected.setLocalScale(
                    selected._baseScale.x * (1 + breathVal * 0.5),
                    selected._baseScale.y * (1 + breathVal),
                    selected._baseScale.z * (1 + breathVal * 0.5)
                );
            }
        }

        // 3. Idle Sway
        if (swayEnabled) {
            const swayVal = Math.sin(driverTime * 1.4) * swayAmount;
            if (bones) {
                const spineIdx = findBoneIndexByKeywords(bones, ['spine', 'hips', 'pelvis']);
                const spineBone = spineIdx >= 0 ? bones[spineIdx] : null;
                if (spineBone && typeof spineBone.setLocalEulerAngles === 'function') {
                    const baseR = getBindRot(bindPose, spineIdx, spineBone.getLocalEulerAngles ? spineBone.getLocalEulerAngles() : null);
                    spineBone.setLocalEulerAngles(baseR.x, baseR.y, baseR.z + swayVal);
                }
            } else if (selected._baseRot && typeof selected.setEulerAngles === 'function') {
                selected.setEulerAngles(selected._baseRot.x, selected._baseRot.y, selected._baseRot.z + swayVal * 0.5);
            }
        }

        // 4. Head Bob
        if (headBobEnabled && bones) {
            const headIdx = findBoneIndexByKeywords(bones, ['head', 'neck']);
            const headBone = headIdx >= 0 ? bones[headIdx] : null;
            if (headBone && typeof headBone.setLocalEulerAngles === 'function') {
                const baseR = getBindRot(bindPose, headIdx, headBone.getLocalEulerAngles ? headBone.getLocalEulerAngles() : null);
                const bobX = Math.sin(driverTime * 2.5) * 4.0;
                const bobY = Math.cos(driverTime * 1.7) * 3.0;
                headBone.setLocalEulerAngles(baseR.x + bobX, baseR.y + bobY, baseR.z);
            }
        }

        // 5. Walk Cycle
        if (walkEnabled && bones) {
            const cycle = driverTime * walkSpeed * Math.PI * 2;
            const swing = Math.sin(cycle) * 28;
            const applyLegOrArm = (keywords, sign) => {
                const bIdx = findBoneIndexByKeywords(bones, keywords);
                const b = bIdx >= 0 ? bones[bIdx] : null;
                if (b && typeof b.setLocalEulerAngles === 'function') {
                    const baseR = getBindRot(bindPose, bIdx, b.getLocalEulerAngles ? b.getLocalEulerAngles() : null);
                    b.setLocalEulerAngles(baseR.x + swing * sign, baseR.y, baseR.z);
                }
            };
            applyLegOrArm(['leftupleg', 'left_leg', 'leg_l', 'thigh_l', 'l_upleg'], 1);
            applyLegOrArm(['rightupleg', 'right_leg', 'leg_r', 'thigh_r', 'r_upleg'], -1);
            applyLegOrArm(['leftupperarm', 'left_arm', 'arm_l', 'shoulder_l', 'l_upperarm'], -0.7);
            applyLegOrArm(['rightupperarm', 'right_arm', 'arm_r', 'shoulder_r', 'r_upperarm'], 0.7);
        }
    }

    function bindDriverUI() {
        try {
            const btnDriver = byId('btnCharDriver');
            if (btnDriver) {
                btnDriver.onclick = () => {
                    const selected = getSelectedObj();
                    if (!driverEnabled && selected) {
                        attachDriverToSelected();
                    } else {
                        toggleCharDriverPanel();
                    }
                };
            }

            const cbBlink = byId('toggleBlink');
            if (cbBlink) {
                cbBlink.checked = blinkEnabled;
                cbBlink.onchange = (e) => { blinkEnabled = !!e.target.checked; };
            }

            const cbBreath = byId('toggleBreath');
            if (cbBreath) {
                cbBreath.checked = breathEnabled;
                cbBreath.onchange = (e) => { breathEnabled = !!e.target.checked; };
            }

            const slBreath = byId('breathSpeed');
            if (slBreath) {
                slBreath.value = String(breathSpeed);
                slBreath.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    if (isFinite(v)) breathSpeed = v;
                    const out = byId('breathSpeedOut');
                    if (out) out.textContent = breathSpeed.toFixed(1);
                };
            }

            const cbSway = byId('toggleSway');
            if (cbSway) {
                cbSway.checked = swayEnabled;
                cbSway.onchange = (e) => { swayEnabled = !!e.target.checked; };
            }

            const slSway = byId('swayAmount');
            if (slSway) {
                slSway.value = String(swayAmount);
                slSway.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    if (isFinite(v)) swayAmount = v;
                    const out = byId('swayAmountOut');
                    if (out) out.textContent = swayAmount.toFixed(1);
                };
            }

            const cbBob = byId('toggleHeadBob');
            if (cbBob) {
                cbBob.checked = headBobEnabled;
                cbBob.onchange = (e) => { headBobEnabled = !!e.target.checked; };
            }

            const cbWalk = byId('toggleWalk');
            if (cbWalk) {
                cbWalk.checked = walkEnabled;
                cbWalk.onchange = (e) => { walkEnabled = !!e.target.checked; };
            }

            const slWalk = byId('walkSpeed');
            if (slWalk) {
                slWalk.value = String(walkSpeed);
                slWalk.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    if (isFinite(v)) walkSpeed = v;
                    const out = byId('walkSpeedOut');
                    if (out) out.textContent = walkSpeed.toFixed(1);
                };
            }

            const btnReset = byId('resetDriverPose');
            if (btnReset) btnReset.onclick = resetDriverPose;

            const btnDetach = byId('btnDetachDriver');
            if (btnDetach) btnDetach.onclick = detachDriver;

            updateDriverButtonState();
        } catch (err) {
            logDriver("bindDriverUI warning: " + err.message);
        }
    }

    function hookDriverLoop() {
        const pcApp = getDriverApp();
        if (!pcApp || typeof pcApp.on !== 'function') return false;
        if (pcApp.__vtfCharDriverBound) return true;
        pcApp.__vtfCharDriverBound = true;

        pcApp.on('update', (dt) => {
            if (!driverEnabled) return;
            updateProceduralAnimation(dt);
        });
        return true;
    }

    bindDriverUI();
    window.__vtfBindDriverControls = bindDriverUI;

    if (!hookDriverLoop()) {
        let tries = 0;
        const timer = setInterval(() => {
            tries++;
            if (hookDriverLoop() || tries > 100) clearInterval(timer);
        }, 100);
    }

    window.CharacterDriver = {
        attach: attachDriverToSelected,
        detach: detachDriver,
        resetPose: resetDriverPose,
        bindUI: bindDriverUI
    };

    logDriver("✅ character_driver.js loaded");
})();
