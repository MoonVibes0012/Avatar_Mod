/* ===== VTuber Forge — js/ui/motion_controls.js ===== */
// Kontrol motion prosedural (Spin, Pulse, Wobble) & pemutaran animation clip

(function () {
    'use strict';

    let activeClipTimer = null;
    let activeClipElapsed = 0;
    let activeClipDuration = 1.0;
    let activeClipPlaying = false;
    let activeClipTracks = null;

    /**
     * Mengambil elemen DOM berdasarkan ID secara aman.
     */
    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            return null;
        }
    }

    /**
     * Memperbarui teks status pada bar status aplikasi jika elemen tersedia.
     */
    function setMotionStatus(msg) {
        try {
            const el = byId('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Mengambil entitas objek terpilih pada state global S secara aman.
     */
    function getSelectedTarget() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    /**
     * Mencatat snapshot undo/redo secara aman setelah perubahan motion prosedural.
     */
    function commitHistorySafe() {
        if (typeof window.saveState === 'function') {
            try { window.saveState(); } catch (e) {}
            return;
        }
        try {
            if (typeof saveState === 'function') saveState();
        } catch (e) {}
    }

    /**
     * Menyinkronkan daftar clip pada dropdown #animSelect dengan properti _animAssets/_animNames
     * milik objek yang sedang dipilih.
     */
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

    /**
     * Menyinkronkan status aktif tombol Spin, Pulse, dan Wobble serta daftar clip animasi.
     */
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

    /**
     * Menghentikan loop evaluasi track animasi manual jika sedang berjalan.
     */
    function stopManualTrackLoop() {
        activeClipPlaying = false;
        if (activeClipTimer !== null) {
            clearInterval(activeClipTimer);
            activeClipTimer = null;
        }
    }

    /**
     * Mengevaluasi track animasi glTF pada waktu tertentu secara loop.
     */
    function applyManualTrackSample(tracks, timeSec, durationSec) {
        if (!Array.isArray(tracks) || tracks.length === 0) return;
        const dur = Math.max(0.01, Number(durationSec) || 1.0);
        const t = ((Number(timeSec) || 0) % dur + dur) % dur;

        tracks.forEach((tr) => {
            if (!tr || !tr.node || !tr.times || !tr.values || tr.times.length === 0) return;
            const times = tr.times;
            const values = tr.values;

            let frameIdx = 0;
            for (let i = 0; i < times.length; i++) {
                if (Number(times[i]) <= t) frameIdx = i;
                else break;
            }

            if (tr.path === 'translation' && values.length >= 3 && typeof tr.node.setLocalPosition === 'function') {
                const baseIdx = Math.min(frameIdx * 3, values.length - 3);
                tr.node.setLocalPosition(values[baseIdx] || 0, values[baseIdx + 1] || 0, values[baseIdx + 2] || 0);
            } else if (tr.path === 'rotation' && values.length >= 4 && typeof tr.node.setLocalRotation === 'function') {
                const baseIdx = Math.min(frameIdx * 4, values.length - 4);
                tr.node.setLocalRotation(
                    new pc.Quat(values[baseIdx] || 0, values[baseIdx + 1] || 0, values[baseIdx + 2] || 0, values[baseIdx + 3] || 1)
                );
            } else if (tr.path === 'scale' && values.length >= 3 && typeof tr.node.setLocalScale === 'function') {
                const baseIdx = Math.min(frameIdx * 3, values.length - 3);
                tr.node.setLocalScale(values[baseIdx] || 1, values[baseIdx + 1] || 1, values[baseIdx + 2] || 1);
            }
        });
    }

    /**
     * Memulai loop pemutaran track animasi bila komponen pc.Animation tidak memiliki resource aktif.
     */
    function startManualTrackLoop(asset) {
        stopManualTrackLoop();
        if (!asset || !Array.isArray(asset._gltfTracks) || asset._gltfTracks.length === 0) return;

        activeClipTracks = asset._gltfTracks;
        activeClipDuration = Math.max(0.05, Number(asset.duration) || 1.0);
        activeClipPlaying = true;

        let lastTick = Date.now();
        activeClipTimer = setInterval(() => {
            if (!activeClipPlaying || !activeClipTracks) return;
            const now = Date.now();
            const dt = Math.min(0.1, Math.max(0, (now - lastTick) / 1000));
            lastTick = now;
            activeClipElapsed += dt;
            applyManualTrackSample(activeClipTracks, activeClipElapsed, activeClipDuration);
        }, 33);
    }

    /**
     * Mengikat event klik sekali pada elemen tombol tertentu.
     */
    function bindOnce(el, handler) {
        if (!el || el.dataset.vtfMotionBound === '1') return;
        el.dataset.vtfMotionBound = '1';
        el.onclick = handler;
    }

    /**
     * Menghubungkan seluruh tombol motion prosedural dan kontrol pemutaran clip animasi.
     */
    function bindMotionControls() {
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
            if (activeClipTimer !== null) {
                clearInterval(activeClipTimer);
                activeClipTimer = null;
            }
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
