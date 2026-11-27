/* ===== VTuber Forge — js/anatomy/anatomy_registry.js ===== */
// Kamus bagian anatomi (termasuk upperChest, leftFoot, rightFoot), alias bone/node VRM, batas kinematika, & pasangan simetri

(function () {
    'use strict';

    const ANATOMY_PARTS = {
        hips: {
            id: 'hips',
            label: 'Hips / Pinggul',
            group: 'core',
            mode: 'hybrid',
            color: [1.0, 0.78, 0.22],
            size: 0.065,
            limits: { rx: [-45, 45], ry: [-60, 60], rz: [-45, 45], pos: 0.35 },
            fallbackRatio: [0.0, 0.50, 0.0],
            aliases: ['hips', 'pelvis', 'root_hips', 'j_bip_c_hips', 'mixamorighips', 'hip', 'koshi']
        },
        spine: {
            id: 'spine',
            label: 'Spine / Pinggang',
            group: 'core',
            mode: 'rotate',
            color: [0.35, 0.85, 1.0],
            size: 0.055,
            limits: { rx: [-40, 45], ry: [-50, 50], rz: [-40, 40] },
            fallbackRatio: [0.0, 0.58, 0.0],
            aliases: ['spine', 'spine1', 'j_bip_c_spine', 'mixamorigspine', 'abdomen', 'waist']
        },
        chest: {
            id: 'chest',
            label: 'Chest / Dada',
            group: 'core',
            mode: 'rotate',
            color: [0.35, 0.85, 1.0],
            size: 0.060,
            limits: { rx: [-40, 45], ry: [-50, 50], rz: [-40, 40] },
            fallbackRatio: [0.0, 0.66, 0.0],
            aliases: ['chest', 'spine2', 'j_bip_c_chest', 'mixamorigspine1', 'thorax', 'mune']
        },
        upperChest: {
            id: 'upperChest',
            label: 'Upper Chest / Dada Atas',
            group: 'extended',
            mode: 'rotate',
            color: [0.35, 0.92, 1.0],
            size: 0.055,
            limits: { rx: [-35, 40], ry: [-45, 45], rz: [-35, 35] },
            fallbackRatio: [0.0, 0.72, 0.0],
            aliases: ['upperchest', 'j_bip_c_upperchest', 'mixamorigspine2', 'upper_chest']
        },
        neck: {
            id: 'neck',
            label: 'Neck / Leher',
            group: 'core',
            mode: 'rotate',
            color: [0.45, 1.0, 0.65],
            size: 0.048,
            limits: { rx: [-45, 50], ry: [-65, 65], rz: [-45, 45] },
            fallbackRatio: [0.0, 0.78, 0.0],
            aliases: ['neck', 'j_bip_c_neck', 'mixamorigneck', 'kubi']
        },
        head: {
            id: 'head',
            label: 'Head / Kepala',
            group: 'core',
            mode: 'rotate',
            color: [0.45, 1.0, 0.65],
            size: 0.068,
            limits: { rx: [-55, 55], ry: [-80, 80], rz: [-50, 50] },
            fallbackRatio: [0.0, 0.88, 0.0],
            aliases: ['head', 'j_bip_c_head', 'mixamorighead', 'atama']
        },
        leftShoulder: {
            id: 'leftShoulder',
            label: 'L. Shoulder / Bahu Kiri',
            group: 'extended',
            mirror: 'rightShoulder',
            mode: 'rotate',
            color: [0.95, 0.55, 0.95],
            size: 0.046,
            limits: { rx: [-45, 45], ry: [-45, 45], rz: [-45, 45] },
            fallbackRatio: [0.10, 0.74, 0.0],
            aliases: ['leftshoulder', 'l_shoulder', 'shoulder_l', 'j_bip_l_shoulder', 'mixamorigleftshoulder', 'clavicle_l', 'leftclavicle']
        },
        leftUpperArm: {
            id: 'leftUpperArm',
            label: 'L. Upper Arm / Lengan Atas Kiri',
            group: 'core',
            mirror: 'rightUpperArm',
            mode: 'rotate',
            color: [0.95, 0.55, 0.95],
            size: 0.054,
            limits: { rx: [-130, 130], ry: [-110, 110], rz: [-130, 130] },
            fallbackRatio: [0.18, 0.72, 0.0],
            aliases: ['leftupperarm', 'upperarm_l', 'l_upperarm', 'arm_l', 'leftarm', 'j_bip_l_upperarm', 'mixamorigleftarm', 'ude_l']
        },
        leftLowerArm: {
            id: 'leftLowerArm',
            label: 'L. Forearm / Lengan Bawah Kiri',
            group: 'core',
            mirror: 'rightLowerArm',
            mode: 'rotate',
            color: [0.95, 0.55, 0.95],
            size: 0.050,
            limits: { rx: [-145, 30], ry: [-110, 110], rz: [-145, 145] },
            fallbackRatio: [0.28, 0.60, 0.0],
            aliases: ['leftlowerarm', 'lowerarm_l', 'l_lowerarm', 'forearm_l', 'leftforearm', 'j_bip_l_lowerarm', 'mixamorigleftforearm', 'hiji_l']
        },
        leftHand: {
            id: 'leftHand',
            label: 'L. Hand / Tangan Kiri',
            group: 'extended',
            mirror: 'rightHand',
            mode: 'rotate',
            color: [0.95, 0.55, 0.95],
            size: 0.045,
            limits: { rx: [-85, 85], ry: [-75, 75], rz: [-85, 85] },
            fallbackRatio: [0.36, 0.49, 0.0],
            aliases: ['lefthand', 'hand_l', 'l_hand', 'wrist_l', 'j_bip_l_hand', 'mixamoriglefthand', 'te_l']
        },
        rightShoulder: {
            id: 'rightShoulder',
            label: 'R. Shoulder / Bahu Kanan',
            group: 'extended',
            mirror: 'leftShoulder',
            mode: 'rotate',
            color: [0.55, 0.72, 1.0],
            size: 0.046,
            limits: { rx: [-45, 45], ry: [-45, 45], rz: [-45, 45] },
            fallbackRatio: [-0.10, 0.74, 0.0],
            aliases: ['rightshoulder', 'r_shoulder', 'shoulder_r', 'j_bip_r_shoulder', 'mixamorigrightshoulder', 'clavicle_r', 'rightclavicle']
        },
        rightUpperArm: {
            id: 'rightUpperArm',
            label: 'R. Upper Arm / Lengan Atas Kanan',
            group: 'core',
            mirror: 'leftUpperArm',
            mode: 'rotate',
            color: [0.55, 0.72, 1.0],
            size: 0.054,
            limits: { rx: [-130, 130], ry: [-110, 110], rz: [-130, 130] },
            fallbackRatio: [-0.18, 0.72, 0.0],
            aliases: ['rightupperarm', 'upperarm_r', 'r_upperarm', 'arm_r', 'rightarm', 'j_bip_r_upperarm', 'mixamorigrightarm', 'ude_r']
        },
        rightLowerArm: {
            id: 'rightLowerArm',
            label: 'R. Forearm / Lengan Bawah Kanan',
            group: 'core',
            mirror: 'leftLowerArm',
            mode: 'rotate',
            color: [0.55, 0.72, 1.0],
            size: 0.050,
            limits: { rx: [-145, 30], ry: [-110, 110], rz: [-145, 145] },
            fallbackRatio: [-0.28, 0.60, 0.0],
            aliases: ['rightlowerarm', 'lowerarm_r', 'r_lowerarm', 'forearm_r', 'rightforearm', 'j_bip_r_lowerarm', 'mixamorigrightforearm', 'hiji_r']
        },
        rightHand: {
            id: 'rightHand',
            label: 'R. Hand / Tangan Kanan',
            group: 'extended',
            mirror: 'leftHand',
            mode: 'rotate',
            color: [0.55, 0.72, 1.0],
            size: 0.045,
            limits: { rx: [-85, 85], ry: [-75, 75], rz: [-85, 85] },
            fallbackRatio: [-0.36, 0.49, 0.0],
            aliases: ['righthand', 'hand_r', 'r_hand', 'wrist_r', 'j_bip_r_hand', 'mixamorigrighthand', 'te_r']
        },
        leftUpperLeg: {
            id: 'leftUpperLeg',
            label: 'L. Thigh / Paha Kiri',
            group: 'core',
            mirror: 'rightUpperLeg',
            mode: 'rotate',
            color: [1.0, 0.55, 0.45],
            size: 0.056,
            limits: { rx: [-125, 95], ry: [-75, 75], rz: [-75, 75] },
            fallbackRatio: [0.09, 0.45, 0.0],
            aliases: ['leftupperleg', 'upperleg_l', 'l_upperleg', 'thigh_l', 'leftthigh', 'j_bip_l_upperleg', 'mixamorigleftupleg', 'momo_l']
        },
        leftLowerLeg: {
            id: 'leftLowerLeg',
            label: 'L. Shin / Betis Kiri',
            group: 'extended',
            mirror: 'rightLowerLeg',
            mode: 'rotate',
            color: [1.0, 0.55, 0.45],
            size: 0.050,
            limits: { rx: [-15, 145], ry: [-45, 45], rz: [-35, 35] },
            fallbackRatio: [0.09, 0.25, 0.0],
            aliases: ['leftlowerleg', 'lowerleg_l', 'l_lowerleg', 'calf_l', 'shin_l', 'leftleg', 'j_bip_l_lowerleg', 'mixamorigleftleg', 'sune_l']
        },
        leftFoot: {
            id: 'leftFoot',
            label: 'L. Foot / Kaki Kiri',
            group: 'extended',
            mirror: 'rightFoot',
            mode: 'rotate',
            color: [1.0, 0.55, 0.45],
            size: 0.044,
            limits: { rx: [-60, 65], ry: [-45, 45], rz: [-45, 45] },
            fallbackRatio: [0.09, 0.06, 0.04],
            aliases: ['leftfoot', 'foot_l', 'l_foot', 'ankle_l', 'j_bip_l_foot', 'mixamorigleftfoot', 'ashi_l']
        },
        rightUpperLeg: {
            id: 'rightUpperLeg',
            label: 'R. Thigh / Paha Kanan',
            group: 'core',
            mirror: 'leftUpperLeg',
            mode: 'rotate',
            color: [1.0, 0.72, 0.42],
            size: 0.056,
            limits: { rx: [-125, 95], ry: [-75, 75], rz: [-75, 75] },
            fallbackRatio: [-0.09, 0.45, 0.0],
            aliases: ['rightupperleg', 'upperleg_r', 'r_upperleg', 'thigh_r', 'rightthigh', 'j_bip_r_upperleg', 'mixamorigrightupleg', 'momo_r']
        },
        rightLowerLeg: {
            id: 'rightLowerLeg',
            label: 'R. Shin / Betis Kanan',
            group: 'extended',
            mirror: 'leftLowerLeg',
            mode: 'rotate',
            color: [1.0, 0.72, 0.42],
            size: 0.050,
            limits: { rx: [-15, 145], ry: [-45, 45], rz: [-35, 35] },
            fallbackRatio: [-0.09, 0.25, 0.0],
            aliases: ['rightlowerleg', 'lowerleg_r', 'r_lowerleg', 'calf_r', 'shin_r', 'rightleg', 'j_bip_r_lowerleg', 'mixamorigrightleg', 'sune_r']
        },
        rightFoot: {
            id: 'rightFoot',
            label: 'R. Foot / Kaki Kanan',
            group: 'extended',
            mirror: 'leftFoot',
            mode: 'rotate',
            color: [1.0, 0.72, 0.42],
            size: 0.044,
            limits: { rx: [-60, 65], ry: [-45, 45], rz: [-45, 45] },
            fallbackRatio: [-0.09, 0.06, 0.04],
            aliases: ['rightfoot', 'foot_r', 'r_foot', 'ankle_r', 'j_bip_r_foot', 'mixamorigrightfoot', 'ashi_r']
        }
    };

    const ACCESSORY_KEYWORDS = [
        'hair', 'bangs', 'ponytail', 'twintail', 'ahoge', 'ribbon',
        'ear', 'kemonomimi', 'tail', 'wing', 'cape', 'skirt', 'hat', 'accessory', 'acc'
    ];

    const PART_ORDER = Object.keys(ANATOMY_PARTS);

    function normalizeNodeName(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .replace(/^armature_?/, '')
            .replace(/^root_?/, '');
    }

    function matchPartByName(nodeName) {
        const clean = normalizeNodeName(nodeName);
        if (!clean) return null;

        for (let i = 0; i < PART_ORDER.length; i++) {
            const key = PART_ORDER[i];
            const aliases = ANATOMY_PARTS[key].aliases;
            for (let j = 0; j < aliases.length; j++) {
                if (clean === aliases[j]) return key;
            }
        }

        for (let i = 0; i < PART_ORDER.length; i++) {
            const key = PART_ORDER[i];
            const aliases = ANATOMY_PARTS[key].aliases;
            for (let j = 0; j < aliases.length; j++) {
                const alias = aliases[j];
                if (alias.length >= 4 && clean.indexOf(alias) !== -1) {
                    return key;
                }
            }
        }
        return null;
    }

    function isAccessoryOrSpringName(nodeName) {
        const clean = normalizeNodeName(nodeName);
        if (!clean) return false;
        for (let i = 0; i < ACCESSORY_KEYWORDS.length; i++) {
            if (clean.indexOf(ACCESSORY_KEYWORDS[i]) !== -1) return true;
        }
        return false;
    }

    function clampAngle(val, range) {
        if (!Array.isArray(range) || range.length < 2) return val;
        return Math.max(range[0], Math.min(range[1], val));
    }

    function clampEulerDelta(partId, eulerVec) {
        const def = ANATOMY_PARTS[partId];
        if (!def || !def.limits || !eulerVec) return eulerVec;
        eulerVec.x = clampAngle(eulerVec.x, def.limits.rx);
        eulerVec.y = clampAngle(eulerVec.y, def.limits.ry);
        eulerVec.z = clampAngle(eulerVec.z, def.limits.rz);
        return eulerVec;
    }

    function getPartDef(partId) {
        return ANATOMY_PARTS[partId] || null;
    }

    function getPartIdsByDensity(density) {
        if (density === 'full') return PART_ORDER.slice();
        return PART_ORDER.filter(id => ANATOMY_PARTS[id].group === 'core');
    }

    window.AnatomyRegistry = {
        PARTS: ANATOMY_PARTS,
        PART_ORDER: PART_ORDER,
        normalizeNodeName: normalizeNodeName,
        matchPartByName: matchPartByName,
        isAccessoryOrSpringName: isAccessoryOrSpringName,
        clampEulerDelta: clampEulerDelta,
        getPartDef: getPartDef,
        getPartIdsByDensity: getPartIdsByDensity
    };
})();
