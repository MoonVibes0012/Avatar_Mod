/* ===== VTuber Forge — js/anatomy/anatomy_expression_link.js ===== */
// Sinkronisasi ringan antara bagian kepala/wajah anatomi & morph/ekspresi VRM agar tidak saling menimpa

(function () {
    'use strict';

    let expressionSyncEnabled = true;

    function getHeadPartEntry() {
        if (!window.AnatomySolver || typeof window.AnatomySolver.getRecord !== 'function') return null;
        const rec = window.AnatomySolver.getRecord();
        if (!rec || !rec.parts) return null;
        return rec.parts.head || rec.parts.neck || null;
    }

    function collectMorphNames(record) {
        const names = [];
        if (!record || !Array.isArray(record.morphTargets)) return names;
        const seen = new Set();

        for (let i = 0; i < record.morphTargets.length; i++) {
            const mi = record.morphTargets[i];
            const targets = (mi && mi.morph && Array.isArray(mi.morph._targets)) ? mi.morph._targets : [];
            for (let j = 0; j < targets.length; j++) {
                const t = targets[j];
                const n = t && (t.name || t._name);
                if (n && !seen.has(n)) {
                    seen.add(n);
                    names.push(n);
                }
            }
        }
        return names;
    }

    function applyExpressionWeight(name, weight) {
        if (!expressionSyncEnabled || !window.AnatomySolver) return false;
        const rec = window.AnatomySolver.getRecord();
        if (!rec || !Array.isArray(rec.morphTargets)) return false;

        const w = Math.max(0, Math.min(1, Number(weight) || 0));
        let applied = false;

        for (let i = 0; i < rec.morphTargets.length; i++) {
            const mi = rec.morphTargets[i];
            if (!mi || typeof mi.setWeight !== 'function' || !mi.morph || !Array.isArray(mi.morph._targets)) continue;
            for (let j = 0; j < mi.morph._targets.length; j++) {
                const t = mi.morph._targets[j];
                const n = t && (t.name || t._name);
                if (n === name) {
                    try {
                        mi.setWeight(j, w);
                        applied = true;
                    } catch (e) {}
                }
            }
        }
        return applied;
    }

    function getHeadTiltSummary() {
        const headEntry = getHeadPartEntry();
        if (!headEntry || !headEntry.offsetEuler) {
            return { pitch: 0, yaw: 0, roll: 0 };
        }
        return {
            pitch: Number(headEntry.offsetEuler.x.toFixed(2)),
            yaw: Number(headEntry.offsetEuler.y.toFixed(2)),
            roll: Number(headEntry.offsetEuler.z.toFixed(2))
        };
    }

    window.AnatomyExpressionLink = {
        setEnabled: function (flag) { expressionSyncEnabled = !!flag; },
        isEnabled: function () { return expressionSyncEnabled; },
        getMorphNames: function () {
            if (!window.AnatomySolver) return [];
            return collectMorphNames(window.AnatomySolver.getRecord());
        },
        setExpressionWeight: applyExpressionWeight,
        getHeadTiltSummary: getHeadTiltSummary
    };
})();
