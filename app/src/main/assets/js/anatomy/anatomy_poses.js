/* ===== VTuber Forge — js/anatomy/anatomy_poses.js ===== */
// Preset pose anatomi cepat (Rest, Relaxed, Greeting) & penyimpanan/pemuatan snapshot pose

(function () {
    'use strict';

    const STORAGE_KEY = 'vtuber_forge_anatomy_poses_v1';

    const BUILTIN_POSES = {
        rest: {
            label: 'Rest Pose',
            parts: {}
        },
        relaxed: {
            label: 'Relaxed Idle',
            parts: {
                spine: { rx: 3, ry: 0, rz: 0, px: 0, py: 0, pz: 0 },
                chest: { rx: 4, ry: 0, rz: 0, px: 0, py: 0, pz: 0 },
                head: { rx: -3, ry: 4, rz: 2, px: 0, py: 0, pz: 0 },
                leftUpperArm: { rx: 10, ry: 0, rz: -22, px: 0, py: 0, pz: 0 },
                leftLowerArm: { rx: -25, ry: 0, rz: 0, px: 0, py: 0, pz: 0 },
                rightUpperArm: { rx: 10, ry: 0, rz: 22, px: 0, py: 0, pz: 0 },
                rightLowerArm: { rx: -25, ry: 0, rz: 0, px: 0, py: 0, pz: 0 }
            }
        },
        wave_r: {
            label: 'Wave Right',
            parts: {
                chest: { rx: 0, ry: -8, rz: -4, px: 0, py: 0, pz: 0 },
                head: { rx: 4, ry: -10, rz: 8, px: 0, py: 0, pz: 0 },
                rightShoulder: { rx: 0, ry: 0, rz: 15, px: 0, py: 0, pz: 0 },
                rightUpperArm: { rx: -35, ry: 15, rz: 95, px: 0, py: 0, pz: 0 },
                rightLowerArm: { rx: -55, ry: 0, rz: 0, px: 0, py: 0, pz: 0 },
                leftUpperArm: { rx: 8, ry: 0, rz: -18, px: 0, py: 0, pz: 0 }
            }
        }
    };

    function loadCustomPoses() {
        try {
            if (!window.localStorage) return {};
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const data = JSON.parse(raw);
            return (data && typeof data === 'object') ? data : {};
        } catch (e) {
            return {};
        }
    }

    function saveCustomPoses(map) {
        try {
            if (!window.localStorage) return;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
        } catch (e) {}
    }

    function applyPoseByName(name) {
        if (!window.AnatomySolver) return false;
        if (name === 'rest') {
            window.AnatomySolver.resetAllParts();
            return true;
        }
        const custom = loadCustomPoses();
        const preset = BUILTIN_POSES[name] || custom[name];
        if (!preset || !preset.parts) return false;

        window.AnatomySolver.resetAllParts();
        window.AnatomySolver.importPoseSnapshot(preset.parts);
        return true;
    }

    function saveCurrentPoseAs(name) {
        if (!window.AnatomySolver || !name) return false;
        const cleanName = String(name).trim();
        if (!cleanName) return false;
        const snap = window.AnatomySolver.exportPoseSnapshot();
        const custom = loadCustomPoses();
        custom[cleanName] = {
            label: cleanName,
            parts: snap
        };
        saveCustomPoses(custom);
        return true;
    }

    function listPoseNames() {
        const custom = loadCustomPoses();
        return Object.keys(BUILTIN_POSES).concat(Object.keys(custom));
    }

    window.AnatomyPoses = {
        BUILTIN: BUILTIN_POSES,
        applyPose: applyPoseByName,
        savePose: saveCurrentPoseAs,
        listPoses: listPoseNames
    };
})();
