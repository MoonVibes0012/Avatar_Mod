/* ===== VTuber Forge — js/animation/character_driver.js ===== */
// Character Driver: Animasi procedural (Auto-Blink, Breathing, Idle Sway, Head Bob, Walk Cycle)

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
        return document.getElementById(id);
    }

    function setDriverStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
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
            const pcApp = window.getPcApp();
            if (pcApp) return pcApp;
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
            driverEnabled = true;
            setActiveDriverFlag(selected, true);
            updateDriverButtonState();
            setDriverStatus("🎭 Character Driver aktif — atur animasi procedural");
        }
    }

    function attachDriverToSelected() {
        const selected = getSelectedObj();
        if (!selected) {
            alert("Pilih model VRM/GLB dulu!");
            return false;
        }
        driverEnabled = true;
        setActiveDriverFlag(selected, true);
        updateDriverButtonState();
        const panel = byId('charDriverPanel');
        if (panel) panel.style.display = 'block';
        setDriverStatus("🎭 Driver aktif pada: " + (selected.name || "Objek"));
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
            if (Array.isArray(selected._bindPose) && typeof selected.findComponent === 'function') {
                const rc = selected.findComponent('render');
                if (rc && Array.isArray(rc.meshInstances)) {
                    for (const mi of rc.meshInstances) {
                        if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                            mi.skinInstance.bones.forEach((bone, idx) => {
                                const bp = selected._bindPose[idx];
                                if (bp && bone && typeof bone.setLocalEulerAngles === 'function') {
                                    bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
                                }
                            });
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            logDriver("Reset pose error: " + e.message);
        }
        setDriverStatus("Pose di-reset");
    }

    function findBlinkIndices(morphNames) {
        if (!Array.isArray(morphNames)) return [];
        const indices = [];
        morphNames.forEach((n, idx) => {
            const lower = String(n || '').toLowerCase();
            if (lower.includes('blink') || lower.includes('eye_close') || lower.includes('eyeclose')) {
                indices.push(idx);
            }
        });
        return indices;
    }

    function findBoneByKeywords(bones, keywords) {
        if (!Array.isArray(bones)) return null;
        return bones.find(b => {
            const name = ((b && b.name) || '').toLowerCase();
            return keywords.some(kw => name.includes(kw));
        }) || null;
    }

    function getBindRot(entity, boneIndex, fallbackEuler) {
        if (entity && Array.isArray(entity._bindPose) && entity._bindPose[boneIndex]) {
            const bp = entity._bindPose[boneIndex];
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

        // 1. Auto-Blink
        if (blinkEnabled && selected._morphInstance && Array.isArray(selected._morphNames)) {
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

                const blinkIndices = findBlinkIndices(selected._morphNames);
                blinkIndices.forEach(idx => {
                    try {
                        if (typeof selected._morphInstance.setWeight === 'function') {
                            selected._morphInstance.setWeight(idx, weight);
                        }
                        const slider = document.querySelector('#morphControls input[data-morph-idx="' + idx + '"]');
                        if (slider) slider.value = weight.toFixed(2);
                        const label = byId('morphVal_' + idx);
                        if (label) label.textContent = weight.toFixed(2);
                    } catch (e) {}
                });
            }
        }

        const renderComp = typeof selected.findComponent === 'function' ? selected.findComponent('render') : null;
        let bones = null;
        if (renderComp && Array.isArray(renderComp.meshInstances)) {
            for (const mi of renderComp.meshInstances) {
                if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                    bones = mi.skinInstance.bones;
                    break;
                }
            }
        }

        // 2. Breathing
        if (breathEnabled) {
            const phase = driverTime * breathSpeed * Math.PI * 2;
            const breathVal = Math.sin(phase) * 0.015;
            if (bones) {
                const chestBone = findBoneByKeywords(bones, ['chest', 'spine', 'upperchest']);
                if (chestBone && typeof chestBone.setLocalScale === 'function') {
                    chestBone.setLocalScale(1 + breathVal, 1 + breathVal * 0.6, 1 + breathVal);
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
                const spineIdx = Array.isArray(bones)
                    ? bones.findIndex(b => ['spine', 'hips', 'pelvis'].some(kw => (((b && b.name) || '').toLowerCase()).includes(kw)))
                    : -1;
                const spineBone = spineIdx >= 0 ? bones[spineIdx] : null;
                if (spineBone && typeof spineBone.setLocalEulerAngles === 'function') {
                    const baseR = getBindRot(selected, spineIdx, spineBone.getLocalEulerAngles ? spineBone.getLocalEulerAngles() : null);
                    spineBone.setLocalEulerAngles(baseR.x, baseR.y, baseR.z + swayVal);
                }
            } else if (selected._baseRot && typeof selected.setEulerAngles === 'function') {
                selected.setEulerAngles(selected._baseRot.x, selected._baseRot.y, selected._baseRot.z + swayVal * 0.5);
            }
        }

        // 4. Head Bob
        if (headBobEnabled && bones) {
            const headIdx = bones.findIndex(b => ['head', 'neck'].some(kw => (((b && b.name) || '').toLowerCase()).includes(kw)));
            const headBone = headIdx >= 0 ? bones[headIdx] : null;
            if (headBone && typeof headBone.setLocalEulerAngles === 'function') {
                const baseR = getBindRot(selected, headIdx, headBone.getLocalEulerAngles ? headBone.getLocalEulerAngles() : null);
                const bobX = Math.sin(driverTime * 2.5) * 4.0;
                const bobY = Math.cos(driverTime * 1.7) * 3.0;
                headBone.setLocalEulerAngles(baseR.x + bobX, baseR.y + bobY, baseR.z);
            }
        }

        // 5. Walk Cycle (preview gerak tulang dasar)
        if (walkEnabled && bones) {
            const cycle = driverTime * walkSpeed * Math.PI * 2;
            const swing = Math.sin(cycle) * 28;
            const applyLegOrArm = (keywords, sign) => {
                const bIdx = bones.findIndex(b => keywords.some(kw => (((b && b.name) || '').toLowerCase()).includes(kw)));
                const b = bIdx >= 0 ? bones[bIdx] : null;
                if (b && typeof b.setLocalEulerAngles === 'function') {
                    const baseR = getBindRot(selected, bIdx, b.getLocalEulerAngles ? b.getLocalEulerAngles() : null);
                    b.setLocalEulerAngles(baseR.x + swing * sign, baseR.y, baseR.z);
                }
            };
            applyLegOrArm(['leftupleg', 'left_leg', 'leg_l', 'thigh_l'], 1);
            applyLegOrArm(['rightupleg', 'right_leg', 'leg_r', 'thigh_r'], -1);
            applyLegOrArm(['leftupperarm', 'left_arm', 'arm_l', 'shoulder_l'], -0.7);
            applyLegOrArm(['rightupperarm', 'right_arm', 'arm_r', 'shoulder_r'], 0.7);
        }
    }

    function bindDriverUI() {
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
        if (cbBlink) cbBlink.onchange = (e) => { blinkEnabled = !!e.target.checked; };

        const cbBreath = byId('toggleBreath');
        if (cbBreath) cbBreath.onchange = (e) => { breathEnabled = !!e.target.checked; };

        const slBreath = byId('breathSpeed');
        if (slBreath) {
            slBreath.oninput = (e) => {
                const v = parseFloat(e.target.value);
                if (isFinite(v)) breathSpeed = v;
                const out = byId('breathSpeedOut');
                if (out) out.textContent = breathSpeed.toFixed(1);
            };
        }

        const cbSway = byId('toggleSway');
        if (cbSway) cbSway.onchange = (e) => { swayEnabled = !!e.target.checked; };

        const slSway = byId('swayAmount');
        if (slSway) {
            slSway.oninput = (e) => {
                const v = parseFloat(e.target.value);
                if (isFinite(v)) swayAmount = v;
                const out = byId('swayAmountOut');
                if (out) out.textContent = swayAmount.toFixed(1);
            };
        }

        const cbBob = byId('toggleHeadBob');
        if (cbBob) cbBob.onchange = (e) => { headBobEnabled = !!e.target.checked; };

        const cbWalk = byId('toggleWalk');
        if (cbWalk) cbWalk.onchange = (e) => { walkEnabled = !!e.target.checked; };

        const slWalk = byId('walkSpeed');
        if (slWalk) {
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
        resetPose: resetDriverPose
    };

    logDriver("✅ character_driver.js loaded");
})();
