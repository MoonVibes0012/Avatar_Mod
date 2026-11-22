/* ===== VTuber Forge — js/io/dds_loader.js ===== */
// Parser & Software Decoder tekstur .DDS (DXT1, DXT3, DXT5, RGBA/BGRA) menjadi pc.Texture RGBA8

(function () {
    'use strict';

    const DDS_MAGIC = 0x20534444; // "DDS "
    const DDPF_FOURCC = 0x4;
    const DDPF_RGB = 0x40;
    const DDPF_ALPHAPIXELS = 0x1;

    const FOURCC_DXT1 = 0x31545844; // "DXT1"
    const FOURCC_DXT3 = 0x33545844; // "DXT3"
    const FOURCC_DXT5 = 0x35545844; // "DXT5"
    const FOURCC_DX10 = 0x30315844; // "DX10"

    const MAX_TEX_DIM = 1024;

    function unpack565(color, outRgb, offset) {
        const r = (color >> 11) & 0x1f;
        const g = (color >> 5) & 0x3f;
        const b = color & 0x1f;
        outRgb[offset] = (r << 3) | (r >> 2);
        outRgb[offset + 1] = (g << 2) | (g >> 4);
        outRgb[offset + 2] = (b << 3) | (b >> 2);
    }

    function decodeDXT1(src, width, height) {
        const dst = new Uint8Array(width * height * 4);
        const blocksX = Math.max(1, (width + 3) >> 2);
        const blocksY = Math.max(1, (height + 3) >> 2);
        const colors = new Uint8Array(16);
        let srcOffset = 0;

        for (let by = 0; by < blocksY; by++) {
            for (let bx = 0; bx < blocksX; bx++) {
                if (srcOffset + 8 > src.byteLength) return dst;
                const c0 = src[srcOffset] | (src[srcOffset + 1] << 8);
                const c1 = src[srcOffset + 2] | (src[srcOffset + 3] << 8);
                const bits = (src[srcOffset + 4]) |
                             (src[srcOffset + 5] << 8) |
                             (src[srcOffset + 6] << 16) |
                             (src[srcOffset + 7] << 24);
                srcOffset += 8;

                unpack565(c0, colors, 0);
                colors[3] = 255;
                unpack565(c1, colors, 4);
                colors[7] = 255;

                if (c0 > c1) {
                    colors[8] = (2 * colors[0] + colors[4]) / 3;
                    colors[9] = (2 * colors[1] + colors[5]) / 3;
                    colors[10] = (2 * colors[2] + colors[6]) / 3;
                    colors[11] = 255;

                    colors[12] = (colors[0] + 2 * colors[4]) / 3;
                    colors[13] = (colors[1] + 2 * colors[5]) / 3;
                    colors[14] = (colors[2] + 2 * colors[6]) / 3;
                    colors[15] = 255;
                } else {
                    colors[8] = (colors[0] + colors[4]) >> 1;
                    colors[9] = (colors[1] + colors[5]) >> 1;
                    colors[10] = (colors[2] + colors[6]) >> 1;
                    colors[11] = 255;

                    colors[12] = 0;
                    colors[13] = 0;
                    colors[14] = 0;
                    colors[15] = 0;
                }

                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const code = (bits >>> ((py * 4 + px) * 2)) & 0x3;
                        const cIdx = code * 4;
                        const dIdx = (y * width + x) * 4;
                        dst[dIdx] = colors[cIdx];
                        dst[dIdx + 1] = colors[cIdx + 1];
                        dst[dIdx + 2] = colors[cIdx + 2];
                        dst[dIdx + 3] = colors[cIdx + 3];
                    }
                }
            }
        }
        return dst;
    }

    function decodeDXT3(src, width, height) {
        const dst = new Uint8Array(width * height * 4);
        const blocksX = Math.max(1, (width + 3) >> 2);
        const blocksY = Math.max(1, (height + 3) >> 2);
        const colors = new Uint8Array(16);
        let srcOffset = 0;

        for (let by = 0; by < blocksY; by++) {
            for (let bx = 0; bx < blocksX; bx++) {
                if (srcOffset + 16 > src.byteLength) return dst;
                const alphaOffset = srcOffset;
                srcOffset += 8;

                const c0 = src[srcOffset] | (src[srcOffset + 1] << 8);
                const c1 = src[srcOffset + 2] | (src[srcOffset + 3] << 8);
                const bits = (src[srcOffset + 4]) |
                             (src[srcOffset + 5] << 8) |
                             (src[srcOffset + 6] << 16) |
                             (src[srcOffset + 7] << 24);
                srcOffset += 8;

                unpack565(c0, colors, 0);
                unpack565(c1, colors, 4);
                colors[8] = (2 * colors[0] + colors[4]) / 3;
                colors[9] = (2 * colors[1] + colors[5]) / 3;
                colors[10] = (2 * colors[2] + colors[6]) / 3;
                colors[12] = (colors[0] + 2 * colors[4]) / 3;
                colors[13] = (colors[1] + 2 * colors[5]) / 3;
                colors[14] = (colors[2] + 2 * colors[6]) / 3;

                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    const aRow = src[alphaOffset + py * 2] | (src[alphaOffset + py * 2 + 1] << 8);
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const code = (bits >>> ((py * 4 + px) * 2)) & 0x3;
                        const cIdx = code * 4;
                        const a4 = (aRow >>> (px * 4)) & 0xf;
                        const dIdx = (y * width + x) * 4;
                        dst[dIdx] = colors[cIdx];
                        dst[dIdx + 1] = colors[cIdx + 1];
                        dst[dIdx + 2] = colors[cIdx + 2];
                        dst[dIdx + 3] = (a4 << 4) | a4;
                    }
                }
            }
        }
        return dst;
    }

    function decodeDXT5(src, width, height) {
        const dst = new Uint8Array(width * height * 4);
        const blocksX = Math.max(1, (width + 3) >> 2);
        const blocksY = Math.max(1, (height + 3) >> 2);
        const colors = new Uint8Array(16);
        const alphas = new Uint8Array(8);
        let srcOffset = 0;

        for (let by = 0; by < blocksY; by++) {
            for (let bx = 0; bx < blocksX; bx++) {
                if (srcOffset + 16 > src.byteLength) return dst;
                const a0 = src[srcOffset];
                const a1 = src[srcOffset + 1];
                alphas[0] = a0;
                alphas[1] = a1;
                if (a0 > a1) {
                    alphas[2] = (6 * a0 + 1 * a1) / 7;
                    alphas[3] = (5 * a0 + 2 * a1) / 7;
                    alphas[4] = (4 * a0 + 3 * a1) / 7;
                    alphas[5] = (3 * a0 + 4 * a1) / 7;
                    alphas[6] = (2 * a0 + 5 * a1) / 7;
                    alphas[7] = (1 * a0 + 6 * a1) / 7;
                } else {
                    alphas[2] = (4 * a0 + 1 * a1) / 5;
                    alphas[3] = (3 * a0 + 2 * a1) / 5;
                    alphas[4] = (2 * a0 + 3 * a1) / 5;
                    alphas[5] = (1 * a0 + 4 * a1) / 5;
                    alphas[6] = 0;
                    alphas[7] = 255;
                }

                const aBitsLo = src[srcOffset + 2] | (src[srcOffset + 3] << 8) | (src[srcOffset + 4] << 16);
                const aBitsHi = src[srcOffset + 5] | (src[srcOffset + 6] << 8) | (src[srcOffset + 7] << 16);
                srcOffset += 8;

                const c0 = src[srcOffset] | (src[srcOffset + 1] << 8);
                const c1 = src[srcOffset + 2] | (src[srcOffset + 3] << 8);
                const bits = (src[srcOffset + 4]) |
                             (src[srcOffset + 5] << 8) |
                             (src[srcOffset + 6] << 16) |
                             (src[srcOffset + 7] << 24);
                srcOffset += 8;

                unpack565(c0, colors, 0);
                unpack565(c1, colors, 4);
                colors[8] = (2 * colors[0] + colors[4]) / 3;
                colors[9] = (2 * colors[1] + colors[5]) / 3;
                colors[10] = (2 * colors[2] + colors[6]) / 3;
                colors[12] = (colors[0] + 2 * colors[4]) / 3;
                colors[13] = (colors[1] + 2 * colors[5]) / 3;
                colors[14] = (colors[2] + 2 * colors[6]) / 3;

                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const pIdx = py * 4 + px;
                        const aCode = (pIdx < 8)
                            ? ((aBitsLo >>> (pIdx * 3)) & 0x7)
                            : ((aBitsHi >>> ((pIdx - 8) * 3)) & 0x7);
                        const cCode = (bits >>> (pIdx * 2)) & 0x3;
                        const cIdx = cCode * 4;
                        const dIdx = (y * width + x) * 4;
                        dst[dIdx] = colors[cIdx];
                        dst[dIdx + 1] = colors[cIdx + 1];
                        dst[dIdx + 2] = colors[cIdx + 2];
                        dst[dIdx + 3] = alphas[aCode];
                    }
                }
            }
        }
        return dst;
    }

    function decodeUncompressedRGBA(src, width, height, bitCount, rMask, gMask, bMask, aMask) {
        const dst = new Uint8Array(width * height * 4);
        const bytesPerPixel = Math.max(1, bitCount >> 3);
        const totalPixels = width * height;
        const isBGRA = (bMask === 0x000000ff && rMask === 0x00ff0000);

        for (let i = 0; i < totalPixels; i++) {
            const sIdx = i * bytesPerPixel;
            const dIdx = i * 4;
            if (sIdx + bytesPerPixel > src.byteLength) break;

            if (bytesPerPixel >= 4) {
                if (isBGRA) {
                    dst[dIdx] = src[sIdx + 2];
                    dst[dIdx + 1] = src[sIdx + 1];
                    dst[dIdx + 2] = src[sIdx];
                    dst[dIdx + 3] = aMask ? src[sIdx + 3] : 255;
                } else {
                    dst[dIdx] = src[sIdx];
                    dst[dIdx + 1] = src[sIdx + 1];
                    dst[dIdx + 2] = src[sIdx + 2];
                    dst[dIdx + 3] = aMask ? src[sIdx + 3] : 255;
                }
            } else if (bytesPerPixel === 3) {
                if (isBGRA) {
                    dst[dIdx] = src[sIdx + 2];
                    dst[dIdx + 1] = src[sIdx + 1];
                    dst[dIdx + 2] = src[sIdx];
                } else {
                    dst[dIdx] = src[sIdx];
                    dst[dIdx + 1] = src[sIdx + 1];
                    dst[dIdx + 2] = src[sIdx + 2];
                }
                dst[dIdx + 3] = 255;
            } else {
                const v = src[sIdx];
                dst[dIdx] = v;
                dst[dIdx + 1] = v;
                dst[dIdx + 2] = v;
                dst[dIdx + 3] = 255;
            }
        }
        return dst;
    }

    function downscaleRgbaIfNeeded(rgba, width, height, maxDim) {
        if (width <= maxDim && height <= maxDim) {
            return { data: rgba, width: width, height: height };
        }
        const scale = maxDim / Math.max(width, height);
        const newW = Math.max(1, Math.round(width * scale));
        const newH = Math.max(1, Math.round(height * scale));
        const out = new Uint8Array(newW * newH * 4);

        for (let y = 0; y < newH; y++) {
            const srcY = Math.min(height - 1, Math.floor((y / newH) * height));
            for (let x = 0; x < newW; x++) {
                const srcX = Math.min(width - 1, Math.floor((x / newW) * width));
                const sIdx = (srcY * width + srcX) * 4;
                const dIdx = (y * newW + x) * 4;
                out[dIdx] = rgba[sIdx];
                out[dIdx + 1] = rgba[sIdx + 1];
                out[dIdx + 2] = rgba[sIdx + 2];
                out[dIdx + 3] = rgba[sIdx + 3];
            }
        }
        return { data: out, width: newW, height: newH };
    }

    function parseDdsBuffer(arrayBuffer) {
        if (!arrayBuffer || arrayBuffer.byteLength < 128) {
            throw new Error('File DDS terlalu kecil atau rusak.');
        }

        const view = new DataView(arrayBuffer);
        const magic = view.getUint32(0, true);
        if (magic !== DDS_MAGIC) {
            throw new Error('Header magic bukan DDS yang valid.');
        }

        const height = view.getUint32(12, true);
        const width = view.getUint32(16, true);
        if (!width || !height || width > 8192 || height > 8192) {
            throw new Error('Dimensi tekstur DDS tidak valid: ' + width + 'x' + height);
        }

        const pfFlags = view.getUint32(80, true);
        const fourCC = view.getUint32(84, true);
        const rgbBitCount = view.getUint32(88, true);
        const rMask = view.getUint32(92, true);
        const gMask = view.getUint32(96, true);
        const bMask = view.getUint32(100, true);
        const aMask = view.getUint32(104, true);

        let dataOffset = 128;
        let effectiveFourCC = fourCC;

        if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DX10) {
            if (arrayBuffer.byteLength < 148) {
                throw new Error('Header DDS DX10 terpotong.');
            }
            const dxgiFormat = view.getUint32(128, true);
            dataOffset = 148;
            if (dxgiFormat === 71 || dxgiFormat === 72) effectiveFourCC = FOURCC_DXT1;
            else if (dxgiFormat === 74 || dxgiFormat === 75) effectiveFourCC = FOURCC_DXT3;
            else if (dxgiFormat === 77 || dxgiFormat === 78) effectiveFourCC = FOURCC_DXT5;
            else if (dxgiFormat === 28 || dxgiFormat === 29 || dxgiFormat === 87) effectiveFourCC = 0;
            else throw new Error('DXGI format DDS tidak didukung: ' + dxgiFormat);
        }

        const payload = new Uint8Array(arrayBuffer, dataOffset);
        let rgba = null;
        let formatLabel = 'RGBA';

        if (pfFlags & DDPF_FOURCC) {
            if (effectiveFourCC === FOURCC_DXT1) {
                rgba = decodeDXT1(payload, width, height);
                formatLabel = 'DXT1';
            } else if (effectiveFourCC === FOURCC_DXT3) {
                rgba = decodeDXT3(payload, width, height);
                formatLabel = 'DXT3';
            } else if (effectiveFourCC === FOURCC_DXT5) {
                rgba = decodeDXT5(payload, width, height);
                formatLabel = 'DXT5';
            } else if (effectiveFourCC === 0) {
                rgba = decodeUncompressedRGBA(payload, width, height, 32, 0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000);
                formatLabel = 'DX10-RGBA';
            } else {
                throw new Error('Kompresi DDS FourCC tidak didukung (gunakan DXT1/DXT3/DXT5/RGBA).');
            }
        } else if (pfFlags & DDPF_RGB) {
            rgba = decodeUncompressedRGBA(
                payload,
                width,
                height,
                rgbBitCount || 32,
                rMask,
                gMask,
                bMask,
                (pfFlags & DDPF_ALPHAPIXELS) ? aMask : 0
            );
            formatLabel = 'RGB' + (rgbBitCount || 32);
        } else {
            throw new Error('Pixel format DDS tidak didukung.');
        }

        const scaled = downscaleRgbaIfNeeded(rgba, width, height, MAX_TEX_DIM);
        return {
            rgba: scaled.data,
            width: scaled.width,
            height: scaled.height,
            originalWidth: width,
            originalHeight: height,
            format: formatLabel
        };
    }

    function createPlayCanvasTextureFromDds(graphicsDevice, arrayBuffer, name) {
        if (!graphicsDevice || typeof pc === 'undefined' || !pc.Texture) {
            throw new Error('GraphicsDevice PlayCanvas belum siap.');
        }
        const decoded = parseDdsBuffer(arrayBuffer);
        const tex = new pc.Texture(graphicsDevice, {
            name: name || 'dds_texture',
            width: decoded.width,
            height: decoded.height,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            mipmaps: true,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_REPEAT,
            addressV: pc.ADDRESS_REPEAT
        });

        const levels = tex.lock();
        if (levels && levels.set) {
            levels.set(decoded.rgba);
        } else if (Array.isArray(levels) && levels[0] && levels[0].set) {
            levels[0].set(decoded.rgba);
        }
        tex.unlock();
        if (typeof tex.upload === 'function') {
            tex.upload();
        }
        tex._vtfDdsFormat = decoded.format;
        return tex;
    }

    window.VtfDdsLoader = {
        parseDdsBuffer: parseDdsBuffer,
        createTexture: createPlayCanvasTextureFromDds
    };
})();
