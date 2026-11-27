/* ===== VTuber Forge — js/ui/motion_controls.js ===== */
// Kontrol motion prosedural (Spin, Pulse, Wobble) & pemutaran animation clip (Interpolasi LINEAR/STEP/CUBICSPLINE + Quaternion SLERP)

(function () {
    'use strict';

    let activeClipElapsed = 0;
    let activeClipDuration = 1.0;
    let activeClipPlaying = false;
    let activeClipTracks = null;
    let loopHooked = false;

    const tmpQuatA = (typeof pc !== 'undefined' && pc.Quat) ? new pc.Quat() : null;
    const tmpQuatB = (typeof pc !== 'undefined' && pc.Quat) ? new pc.Quat() : null;
    const tmpQuatOut = (typeof pc !== 'undefined' && pc.Quat) ? new pc.Quat() : null;

    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            return null;
        }
    }

    function setMotionStatus(msg) {
        try {
            const el = byId('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    function getAppSafe() {
        if (typeof window.getPcApp === 'function') {
            try {
                const a = window.getPcApp();
                if (a) return a;
            } catch (e) {}
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function getSelectedTarget() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    function commitHistorySafe() {
        if (typeof window.saveState === 'function') {
            try { window.saveState(); } catch (e) {}
            return;
        }
        try {
            if (typeof saveState === 'function') saveState();
        } catch (e) {}
    }

    function syncAnimSelectOptions(target) {
        const animSel = byId('animSelect');
        if (!animSel) return;

        const prevVal = animSel.value;
        animSel.innerHTML = '<option value="">-- Clip Animasi --</option>';

        if (!target || !Array.isArray(target._animAssets) || target._animAssets.length === 0) {
            return;
        }

        target._animAssets.forEach((asset, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            const label = (Array.isArray(target._animNames) && target._animNames[idx])
                ? target._animNames[idx]
                : ((asset && asset.name) ? asset.name : `Clip_${idx + 1}`);
            opt.textContent = label;
            animSel.appendChild(opt);
        });

        if (prevVal !== '' && Number(prevVal) >= 0 && Number(prevVal) < target._animAssets.length) {
            animSel.value = prevVal;
        }
    }

    function syncMotionButtons(entity) {
        const target = entity !== undefined ? entity : getSelectedTarget();
        const spinBtn = byId('animSpin');
        const pulseBtn = byId('animPulse');
        const wobbleBtn = byId('animWobble');
        if (spinBtn) spinBtn.classList.toggle('on', !!(target && target._animSpin));
        if (pulseBtn) pulseBtn.classList.toggle('on', !!(target && target._animPulse));
        if (wobbleBtn) wobbleBtn.classList.toggle('on', !!(target && target._animWobble));
        syncAnimSelectOptions(target);
    }
    window.syncMotionButtons = syncMotionButtons;

    function stopManualTrackLoop() {
        activeClipPlaying = false;
    }

    function findKeyframeInterval(times, t) {
        const n = times.length;
        if (n <= 1 || t <= Number(times[0])) {
            return { i0: 0, i1: 0, alpha: 0, dt: 0 };
        }
        const lastIdx = n - 1;
        if (t >= Number(times[lastIdx])) {
            return { i0: lastIdx, i1: lastIdx, alpha: 0, dt: 0 };
        }
        // Binary search untuk efisiensi pada klip panjang
        let lo = 0;
        let hi = lastIdx;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (Number(times[mid]) <= t) lo = mid;
            else hi = mid;
        }
        const t0 = Number(times[lo]) || 0;
        const t1 = Number(times[hi]) || t0;
        const span = t1 - t0;
        const alpha = span > 1e-6 ? Math.max(0, Math.min(1, (t - t0) / span)) : 0;
        return { i0: lo, i1: hi, alpha: alpha, dt: span };
    }

    function sampleVec3Track(values, stride, i0, i1, alpha, dt, interp, defX, defY, defZ) {
        if (interp === 'CUBICSPLINE' && values.length >= (i1 * 3 + 3) * stride) {
            const b0 = i0 * 3 * stride;
            const b1 = i1 * 3 * stride;
            const s = alpha;
            const s2 = s * s;
            const s3 = s2 * s;
            const h00 = 2 * s3 - 3 * s2 + 1;
            const h10 = s3 - 2 * s2 + s;
            const h01 = -2 * s3 + 3 * s2;
            const h11 = s3 - s2;

            const out = [defX, defY, defZ];
            for (let c = 0; c < 3; c++) {
                const v0 = Number(values[b0 + stride + c]) || 0;
                const outTan0 = Number(values[b0 + 2 * stride + c]) || 0;
                const inTan1 = Number(values[b1 + c]) || 0;
                const v1 = Number(values[b1 + stride + c]) || 0;
                out[c] = h00 * v0 + h10 * dt * outTan0 + h01 * v1 + h11 * dt * inTan1;
            }
            return out;
        }

        const idx0 = Math.min(i0 * stride, values.length - stride);
        const idx1 = Math.min(i1 * stride, values.length - stride);
        const x0 = Number(values[idx0]);
        const y0 = Number(values[idx0 + 1]);
        const z0 = Number(values[idx0 + 2]);

        if (interp === 'STEP' || idx0 === idx1 || alpha <= 0) {
            return [
                isFinite(x0) ? x0 : defX,
                isFinite(y0) ? y0 : defY,
                isFinite(z0) ? z0 : defZ
            ];
        }

        const x1 = Number(values[idx1]);
        const y1 = Number(values[idx1 + 1]);
        const z1 = Number(values[idx1 + 2]);
        return [
            (isFinite(x0) ? x0 : defX) * (1 - alpha) + (isFinite(x1) ? x1 : defX) * alpha,
            (isFinite(y0) ? y0 : defY) * (1 - alpha) + (isFinite(y1) ? y1 : defY) * alpha,
            (isFinite(z0) ? z0 : defZ) * (1 - alpha) + (isFinite(z1) ? z1 : defZ) * alpha
        ];
    }

    function sampleQuatTrack(values, i0, i1, alpha, dt, interp) {
        const qA = tmpQuatA || new pc.Quat();
        const qB = tmpQuatB || new pc.Quat();
        const qOut = tmpQuatOut || new pc.Quat();

        if (interp === 'CUBICSPLINE' && values.length >= (i1 * 3 + 3) * 4) {
            const b0 = i0 * 12;
            const b1 = i1 * 12;
            const s = alpha;
            const s2 = s * s;
            const s3 = s2 * s;
            const h00 = 2 * s3 - 3 * s2 + 1;
            const h10 = s3 - 2 * s2 + s;
            const h01 = -2 * s3 + 3 * s2;
            const h11 = s3 - s2;

            const c = [0, 0, 0, 1];
            for (let k = 0; k < 4; k++) {
                const v0 = Number(values[b0 + 4 + k]) || 0;
                const outTan0 = Number(values[b0 + 8 + k]) || 0;
                const inTan1 = Number(values[b1 + k]) || 0;
                const v1 = Number(values[b1 + 4 + k]) || 0;
                c[k] = h00 * v0 + h10 * dt * outTan0 + h01 * v1 + h11 * dt * inTan1;
            }
            qOut.set(c[0], c[1], c[2], c[3]);
            if (typeof qOut.normalize === 'function') qOut.normalize();
            return qOut;
        }

        const idx0 = Math.min(i0 * 4, values.length - 4);
        qA.set(
            Number(values[idx0]) || 0,
            Number(values[idx0 + 1]) || 0,
            Number(values[idx0 + 2]) || 0,
            Number.isFinite(Number(values[idx0 + 3])) ? Number(values[idx0 + 3]) : 1
        );
        if (typeof qA.normalize === 'function') qA.normalize();

        if (interp === 'STEP' || i0 === i1 || alpha <= 0) {
            return qA;
        }

        const idx1 = Math.min(i1 * 4, values.length - 4);
        qB.set(
            Number(values[idx1]) || 0,
            Number(values[idx1 + 1]) || 0,
            Number(values[idx1 + 2]) || 0,
            Number.isFinite(Number(values[idx1 + 3])) ? Number(values[idx1 + 3]) : 1
        );
        if (typeof qB.normalize === 'function') qB.normalize();

        if (typeof qOut.slerp === 'function') {
            qOut.slerp(qA, qB, alpha);
        } else {
            qOut.set(
                qA.x + (qB.x - qA.x) * alpha,
                qA.y + (qB.y - qA.y) * alpha,
                qA.z + (qB.z - qA.z) * alpha,
                qA.w + (qB.w - qA.w) * alpha
            );
            if (typeof qOut.normalize === 'function') qOut.normalize();
        }
        return qOut;
    }

    /**
     * Mengevaluasi track animasi glTF pada waktu tertentu dengan interpolasi STEP/LINEAR/CUBICSPLINE.
     */
    function applyManualTrackSample(tracks, timeSec, durationSec) {
        if (!Array.isArray(tracks) || tracks.length === 0) return;
        const dur = Math.max(0.01, Number(durationSec) || 1.0);
        const t = ((Number(timeSec) || 0) % dur + dur) % dur;

        for (let idx = 0; idx < tracks.length; idx++) {
            const tr = tracks[idx];
            if (!tr || !tr.node || !tr.times || !tr.values || tr.times.length === 0) continue;

            const interp = String(tr.interpolation || 'LINEAR').toUpperCase();
            const iv = findKeyframeInterval(tr.times, t);

            if (tr.path === 'translation' && tr.values.length >= 3 && typeof tr.node.setLocalPosition === 'function') {
                const p = sampleVec3Track(tr.values, 3, iv.i0, iv.i1, iv.alpha, iv.dt, interp, 0, 0, 0);
                tr.node.setLocalPosition(p[0], p[1], p[2]);
            } else if (tr.path === 'rotation' && tr.values.length >= 4 && typeof tr.node.setLocalRotation === 'function') {
                const q = sampleQuatTrack(tr.values, iv.i0, iv.i1, iv.alpha, iv.dt, interp);
                tr.node.setLocalRotation(q);
            } else if (tr.path === 'scale' && tr.values.length >= 3 && typeof tr.node.setLocalScale === 'function') {
                const s = sampleVec3Track(tr.values, 3, iv.i0, iv.i1, iv.alpha, iv.dt, interp, 1, 1, 1);
                tr.node.setLocalScale(s[0], s[1], s[2]);
            }
        }
    }

    /**
     * Memastikan loop evaluasi clip animasi terikat ke siklus frame PlayCanvas (`app.on('update', dt)`).
     */
    function ensureAppUpdateHook() {
        if (loopHooked) return true;
        const pcApp = getAppSafe();
        if (!pcApp || typeof pcApp.on !== 'function') return false;
        loopHooked = true;

        pcApp.on('update', (dt) => {
            if (!activeClipPlaying || !activeClipTracks) return;
            const safeDt = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? Math.min(dt, 0.1) : 0.016;
            activeClipElapsed += safeDt;
            applyManualTrackSample(activeClipTracks, activeClipElapsed, activeClipDuration);
        });
        return true;
    }

    function startManualTrackLoop(asset) {
        stopManualTrackLoop();
        if (!asset || !Array.isArray(asset._gltfTracks) || asset._gltfTracks.length === 0) return;

        ensureAppUpdateHook();
        activeClipTracks = asset._gltfTracks;
        activeClipDuration = Math.max(0.05, Number(asset.duration) || 1.0);
        activeClipPlaying = true;
    }

    function bindOnce(el, handler) {
        if (!el || el.dataset.vtfMotionBound === '1') return;
        el.dataset.vtfMotionBound = '1';
        el.onclick = handler;
    }

    function bindMotionControls() {
        ensureAppUpdateHook();

        bindOnce(byId('animSpin'), () => {
            const target = getSelectedTarget();
            if (!target) return setMotionStatus('⚠ Pilih objek dulu untuk Auto-Spin.');
            target._animSpin = !target._animSpin;
            if (target._animSpin && !target._baseRot && typeof target.getEulerAngles === 'function') {
                target._baseRot = target.getEulerAngles().clone();
            }
            syncMotionButtons(target);
            commitHistorySafe();
            setMotionStatus('Auto-Spin: ' + (target._animSpin ? 'ON' : 'OFF'));
        });

        bindOnce(byId('animPulse'), () => {
            const target = getSelectedTarget();
            if (!target) return setMotionStatus('⚠ Pilih objek dulu untuk Idle Pulse.');
            target._animPulse = !target._animPulse;
            if (target._animPulse && !target._baseScale && typeof target.getLocalScale === 'function') {
                target._baseScale = target.getLocalScale().clone();
            }
            syncMotionButtons(target);
            commitHistorySafe();
            setMotionStatus('Idle Pulse: ' + (target._animPulse ? 'ON' : 'OFF'));
        });

        bindOnce(byId('animWobble'), () => {
            const target = getSelectedTarget();
            if (!target) return setMotionStatus('⚠ Pilih objek dulu untuk Spring Wobble.');
            target._animWobble = !target._animWobble;
            if (target._animWobble && !target._baseRot && typeof target.getEulerAngles === 'function') {
                target._baseRot = target.getEulerAngles().clone();
            }
            syncMotionButtons(target);
            commitHistorySafe();
            setMotionStatus('Spring Wobble: ' + (target._animWobble ? 'ON' : 'OFF'));
        });

        const animSel = byId('animSelect');
        if (animSel && animSel.dataset.vtfMotionBound !== '1') {
            animSel.dataset.vtfMotionBound = '1';
            animSel.onchange = (e) => {
                const target = getSelectedTarget();
                if (!target || !Array.isArray(target._animAssets)) {
                    return setMotionStatus('⚠ Model terpilih tidak memiliki clip animasi.');
                }
                const idx = parseInt(e.target.value, 10);
                if (isNaN(idx) || idx < 0 || idx >= target._animAssets.length) return;

                const chosenAsset = target._animAssets[idx];
                if (!target.animation && typeof target.addComponent === 'function') {
                    try { target.addComponent('animation'); } catch (err) {}
                }
                if (target.animation) {
                    target.animation.asset = chosenAsset;
                    target.animation.loop = true;
                }
                activeClipElapsed = 0;
                activeClipTracks = chosenAsset && Array.isArray(chosenAsset._gltfTracks) ? chosenAsset._gltfTracks : null;
                activeClipDuration = (chosenAsset && Number(chosenAsset.duration)) || 1.0;

                const animName = (Array.isArray(target._animNames) && target._animNames[idx])
                    ? target._animNames[idx]
                    : ((chosenAsset && chosenAsset.name) ? chosenAsset.name : `Anim_${idx}`);
                setMotionStatus('Animasi siap: ' + animName);
            };
        }

        bindOnce(byId('animPlay'), () => {
            const target = getSelectedTarget();
            if (!target || !Array.isArray(target._animAssets) || target._animAssets.length === 0) {
                return setMotionStatus('⚠ Tidak ada clip animasi pada objek terpilih.');
            }

            const animSelNow = byId('animSelect');
            let idx = animSelNow ? parseInt(animSelNow.value, 10) : NaN;
            if (isNaN(idx) || idx < 0 || idx >= target._animAssets.length) {
                idx = 0;
                if (animSelNow) animSelNow.value = '0';
            }

            const asset = target._animAssets[idx];
            if (!target.animation && typeof target.addComponent === 'function') {
                try { target.addComponent('animation'); } catch (err) {}
            }
            if (target.animation) {
                target.animation.asset = asset;
                target.animation.loop = true;
                if (asset && asset.resource && typeof target.animation.play === 'function') {
                    try {
                        target.animation.play(asset.name || ('Clip_' + idx), 0.1);
                    } catch (err) {
                        try { target.animation.play(); } catch (e2) {}
                    }
                }
            }

            if (!asset || !asset.resource) {
                startManualTrackLoop(asset);
            } else {
                activeClipPlaying = true;
            }

            setMotionStatus('▶ Playing: ' + ((asset && asset.name) ? asset.name : `Clip_${idx + 1}`));
        });

        bindOnce(byId('animPause'), () => {
            const target = getSelectedTarget();
            activeClipPlaying = false;
            if (target && target.animation && typeof target.animation.pause === 'function') {
                try { target.animation.pause(); } catch (err) {}
            }
            setMotionStatus('⏸ Paused');
        });

        bindOnce(byId('animStop'), () => {
            const target = getSelectedTarget();
            activeClipElapsed = 0;
            stopManualTrackLoop();
            if (target && target.animation && typeof target.animation.stop === 'function') {
                try { target.animation.stop(); } catch (err) {}
            }
            if (activeClipTracks) {
                applyManualTrackSample(activeClipTracks, 0, activeClipDuration);
            }
            setMotionStatus('⏹ Stopped');
        });

        syncMotionButtons(getSelectedTarget());
    }

    window.__vtfBindMotionControls = bindMotionControls;

    if (!window.__vtfMotionTreeSyncBound) {
        window.__vtfMotionTreeSyncBound = true;
        document.addEventListener('click', (e) => {
            if (e.target && typeof e.target.closest === 'function' && e.target.closest('#tree, [data-add], #importMenu, #btnImport')) {
                setTimeout(() => {
                    syncMotionButtons(getSelectedTarget());
                }, 0);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindMotionControls);
    } else {
        bindMotionControls();
    }
})();
