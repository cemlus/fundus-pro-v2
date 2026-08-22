#!/usr/bin/env python3
"""
deglare_pipeline.py — specular-glare removal for smartphone / 20D-lens fundus photographs.

STANDALONE. Nothing here is imported by the classifier notebook; it writes cleaned JPEGs
to disk which you can then point CFG["data"] at.

    python deglare_pipeline.py                       # uses default folders below
    python deglare_pipeline.py --in RAW --out CLEAN
    python deglare_pipeline.py --fuse                # multi-frame mode (see README)

Folder contract
---------------
    personal_dataset/
      raw/                 <- PUT YOUR IMAGES HERE (class subfolders optional, preserved)
      clean/
        images/            <- deglared images  (this is what you feed the model)
        masks/             <- binary glare masks, white = repaired pixels
        qc/                <- before/after/mask contact sheets, eyeball these
        rejected/          <- images where glare is too large to honestly repair
        glare_report.csv   <- per-image metrics + keep/review/reject decision

Method (dichromatic reflection model + two-tier repair)
-------------------------------------------------------
1. Locate the retinal disc.        Chroma-based, not brightness-based: the lens barrel and
                                   the room behind it are bright too. Retina = orange hue,
                                   moderate saturation. Everything else is discarded.
2. Separate specular from diffuse. Under the dichromatic model I = diffuse + specular, and
                                   the specular lobe is the illuminant's colour (white LED),
                                   so it lifts ALL three channels equally. Retina is orange:
                                   its blue channel is intrinsically dark. Therefore
                                   min(R,G,B) is almost pure specular signal — this is the
                                   "specular-free image" trick (Tan & Ikeuchi 2005; Shen &
                                   Cai 2009; Yang et al., TPAMI 2016). Subtracting a local
                                   diffuse baseline from the min-channel gives a continuous
                                   specularity map that does NOT fire on the optic disc,
                                   which is bright but strongly chromatic.
3. Two-tier mask.                  Core   = detector clipped, no information survives -> inpaint.
                                   Halo   = brightened but recoverable -> subtract, keep texture.
                                   Hard-thresholding everything is what makes naive pipelines
                                   produce visible plastic blobs.
4. Repair.                         Halo: subtract the achromatic specular term (physics).
                                   Core: Telea inpainting (Telea 2004) at 2x the mask radius.
                                   Purple fringe: chroma-only median repair in LAB, L untouched.
5. Veiling glare / illumination.   Large-scale gain normalisation flattens the wash of light
                                   across one side of the disc without touching local contrast.
6. Honesty gate.                   Inpainting INVENTS pixels. If the core covers > reject_frac
                                   of the disc, or sits on the macula, the image is moved to
                                   rejected/ rather than silently fabricated into the training set.

References
----------
Tan & Ikeuchi, "Separating reflection components of textured surfaces", TPAMI 2005.
Shen & Cai, "Simple and efficient method for specularity removal", Applied Optics 2009.
Yang, Tang & Ahuja, "Efficient and robust specular highlight removal", TPAMI 38(6), 2016.
Telea, "An image inpainting technique based on the fast marching method", J. Graphics Tools 2004.
Bertalmio et al., "Navier-Stokes, fluid dynamics, and image and video inpainting", CVPR 2001.
Shen et al., "Modeling and enhancing low-quality retinal fundus images" (cofe-Net), TMI 2021.
Open Indirect Ophthalmoscope project (hackaday.io/project/11943) — ROI-limited inpainting.
"""

from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional, Tuple, List

import cv2
import numpy as np

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════
@dataclass
class DeglareConfig:
    # ── disc / ROI detection ─────────────────────────────────────────────────
    hue_lo: int = 32           # orange retina: H < hue_lo  or  H > hue_hi   (OpenCV 0..179)
    hue_hi: int = 165
    sat_min: int = 60          # reject the grey lens barrel and the room behind it
    val_min: int = 40          # reject the black surround
    edge_frac: float = 0.55    # retina edge = where S*V falls to this fraction of the plateau
    roi_shrink: float = 0.95   # erode the fitted circle slightly; the rim is always dirty
    min_disc_frac: float = 0.01  # disc must be >=1% of frame or detection is judged failed

    # ── veiling glare (broad additive haze) ──────────────────────────────────
    veil_scale_frac: float = 0.30   # airlight estimation kernel, fraction of disc diameter
    veil_floor_pct: float = 10.0    # percentile of the veil map treated as legitimate signal
    veil_strength: float = 0.90     # 0 = off
    veil_max_gain: float = 1.35     # cap on the post-subtraction brightness restore

    # ── specularity detection ────────────────────────────────────────────────
    baseline_frac: float = 0.14   # median-blur kernel as a fraction of disc diameter
    core_min_chan: int = 150      # min(R,G,B) above this = detector saturated by white light
    core_value: int = 245         # ...or V above this, whichever fires first
    core_sat_max: int = 120       # ...but only if the pixel is also achromatic (protects the optic disc)
    halo_lo: float = 25.0         # specular residue where the soft ramp starts
    halo_hi: float = 90.0         # ...and where it saturates at full strength
    fringe_delta: int = 8         # B > G + delta  => chromatic (purple/blue) flare
    flare_value: int = 120        # flare brighter than this is inpainted, not chroma-fixed
    core_dilate_frac: float = 0.012   # dilate core by this fraction of disc diameter
    min_blob_frac: float = 2e-5   # drop specks smaller than this fraction of the disc

    # ── repair ───────────────────────────────────────────────────────────────
    halo_strength: float = 0.85   # how much of the estimated specular term to subtract
    inpaint_method: str = "telea" # "telea" | "ns"
    inpaint_radius_frac: float = 0.020
    fringe_repair: bool = True
    chroma_kernel_frac: float = 0.10   # chroma reference radius, fraction of disc diameter
    chroma_strength: float = 0.90      # how far to pull tinted pixels back to local retina hue
    fringe_weight: float = 0.80        # chroma-repair weight for faint blue flare
    core_chroma_weight: float = 0.70   # chroma-repair weight over the inpainted fill

    # ── veiling glare / illumination ─────────────────────────────────────────
    flatten: bool = True
    flatten_sigma_frac: float = 0.28   # gaussian sigma as fraction of disc diameter
    flatten_strength: float = 0.55     # 0 = off, 1 = fully flat illumination

    # ── output ───────────────────────────────────────────────────────────────
    out_size: int = 0          # 0 = keep native disc resolution; else square crop to N px
    crop_to_disc: bool = True  # crop away the barrel and the room. Almost always what you want.
    jpeg_quality: int = 96

    # ── honesty gate ─────────────────────────────────────────────────────────
    review_frac: float = 0.02  # core covers >2% of disc  -> flag for review
    reject_frac: float = 0.08  # core covers >8% of disc  -> reject, do not fabricate
    macula_radius_frac: float = 0.18   # central zone; glare here is diagnostically fatal
    macula_reject_frac: float = 0.25   # >25% of the macular zone glared -> reject


# ══════════════════════════════════════════════════════════════════════════════
# Step 1 — locate the retinal disc
# ══════════════════════════════════════════════════════════════════════════════
def find_disc(bgr: np.ndarray, cfg: DeglareConfig) -> Optional[Tuple[int, int, int]]:
    """Return (cx, cy, r) of the retinal disc, or None if detection failed.

    Chroma-driven on purpose. A brightness threshold locks onto the lens barrel highlight
    or the ceiling behind the patient; the retina is the only large ORANGE thing in frame.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mask = (((h < cfg.hue_lo) | (h > cfg.hue_hi)) & (s > cfg.sat_min) & (v > cfg.val_min))
    mask = (mask.astype(np.uint8)) * 255

    k = max(3, int(round(min(bgr.shape[:2]) * 0.025)) | 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((k // 2 | 1, k // 2 | 1), np.uint8))

    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    if n <= 1:
        return None
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    area = stats[idx, cv2.CC_STAT_AREA]
    if area < cfg.min_disc_frac * bgr.shape[0] * bgr.shape[1]:
        return None

    comp = (lab == idx).astype(np.uint8)

    # ── fill interior holes ──────────────────────────────────────────────────
    # A specular hotspot sitting on the retina is white, not orange, so it punches a hole
    # in the middle of this mask — exactly where a glare-removal tool most needs to look.
    # The distance-transform circle fit below treats holes as "outside the disc" and dodges
    # around them, which walks the fitted circle straight off the actual retina and onto some
    # small clean patch near the rim. Since we already know this component IS the disc (it
    # passed the orange/size test above), any hole strictly inside its outer boundary is by
    # definition retina too — glare, a vessel, a pigment fleck — so it gets filled solid before
    # the circle fit runs. Filling by outer contour only (not touching the true outer edge)
    # keeps the honesty gate later in the pipeline free to still detect and repair that glare.
    cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(comp)
    cv2.drawContours(filled, [max(cnts, key=cv2.contourArea)], -1, 1, thickness=cv2.FILLED)
    comp = filled

    # ── centre: peak of the distance transform ──────────────────────────────
    # The largest inscribed circle. Immune to the crescent-shaped protrusions that a
    # min-enclosing-circle fit latches onto when light spills onto the lens barrel.
    dt = cv2.distanceTransform(comp, cv2.DIST_L2, 5)
    _, r_in, _, centre = cv2.minMaxLoc(dt)
    cx, cy = int(centre[0]), int(centre[1])
    if r_in < 8:
        return None

    cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    _, r_out = cv2.minEnclosingCircle(max(cnts, key=cv2.contourArea))

    # ── radius: walk outward until the retina signal collapses ──────────────
    # A min-enclosing fit puts the boundary on the barrel, which then gets classified as
    # glare and inpainted — the failure mode this replaces. Retina-ness is S*V: the retina
    # is saturated AND bright, the barrel is bright but grey, the surround is neither.
    R = int(r_out * 1.25)
    yy, xx = np.indices(bgr.shape[:2])
    ri = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2).astype(np.int32)
    score = (s.astype(np.float32) / 255.0) * (v.astype(np.float32) / 255.0)
    sel = ri < R
    prof = (np.bincount(ri[sel], weights=score[sel], minlength=R)
            / np.maximum(np.bincount(ri[sel], minlength=R), 1))
    prof = np.convolve(prof, np.ones(11) / 11, mode="same")

    lo, hi = int(0.20 * r_in), max(int(0.70 * r_in), int(0.20 * r_in) + 2)
    inner = prof[lo:hi]
    if inner.size == 0:
        return None
    plateau = float(np.median(inner))
    if not np.isfinite(plateau) or plateau <= 1e-4:
        return None                       # no coherent retina signal — not a fundus photo

    thr = cfg.edge_frac * plateau
    r = max(1, int(0.30 * r_in))
    while r < R - 1 and prof[r] > thr:
        r += 1

    r = int(round(min(r, R - 1) * cfg.roi_shrink))
    r = min(r, cx, cy, bgr.shape[1] - cx - 1, bgr.shape[0] - cy - 1) if cfg.crop_to_disc else r
    if r < 8:
        return None
    return cx, cy, r


def disc_mask(shape, circle) -> np.ndarray:
    cx, cy, r = circle
    m = np.zeros(shape[:2], np.uint8)
    cv2.circle(m, (cx, cy), r, 255, -1)
    return m


# ══════════════════════════════════════════════════════════════════════════════
# Step 2a — veiling glare (broad additive haze)
# ══════════════════════════════════════════════════════════════════════════════
def remove_veil(bgr: np.ndarray, roi: np.ndarray, circle, cfg: DeglareConfig) -> np.ndarray:
    """Strip the low-frequency wash of stray light spilling across the retina.

    This is a different animal from a specular spot and needs a different fix. Light scattered
    off the condensing lens and the cornea lands as a broad ADDITIVE white veil: it raises
    luminance and, because it is white on an orange subject, it drains saturation. Divide-based
    illumination correction fixes the brightness and leaves the image looking bleached — the
    colour never comes back, because the problem was additive, not multiplicative.

    Modelled as a spatially varying airlight, as in dark-channel dehazing: estimate it from the
    min-channel at a coarse scale, subtract everything above the cleanest part of the disc, then
    restore the mean level. Saturation returns with the contrast.
    """
    if cfg.veil_strength <= 0:
        return bgr
    _, _, r = circle
    m = roi > 0
    if not m.any():
        return bgr

    mn = bgr.min(axis=2).astype(np.float32)
    fill = float(np.median(mn[m]))
    mn_f = np.where(m, mn, fill).astype(np.float32)

    k = min(255, max(5, int(round(2 * r * cfg.veil_scale_frac)) | 1))
    veil = cv2.medianBlur(mn_f.astype(np.uint8), k).astype(np.float32)
    veil = cv2.GaussianBlur(veil, (0, 0), k * 0.30)

    # The floor is the retina's own diffuse blue, which is signal — only the excess is veil.
    floor = float(np.percentile(veil[m], cfg.veil_floor_pct))
    excess = np.clip(veil - floor, 0, None) * cfg.veil_strength
    excess[~m] = 0.0

    f = bgr.astype(np.float32)
    out = np.clip(f - excess[..., None], 0, 255)

    # Subtraction lowers the overall level; put it back so downstream thresholds still apply.
    before, after = float(f[m].mean()), float(out[m].mean())
    if after > 1e-3:
        out = np.clip(out * min(cfg.veil_max_gain, before / after), 0, 255)
    return np.where(m[..., None], out, f).astype(np.uint8)


# ══════════════════════════════════════════════════════════════════════════════
# Step 2b — specularity map via the dichromatic model
# ══════════════════════════════════════════════════════════════════════════════
def specular_map(bgr: np.ndarray, roi: np.ndarray, circle, cfg: DeglareConfig) -> np.ndarray:
    """Continuous specular-residue map, float32, roughly in 0..255. Zero outside the ROI.

    min(R,G,B) is the specular-free residue: white LED light raises all three channels,
    healthy retina keeps its blue channel dark. Subtracting a large-kernel median of that
    residue removes the legitimate diffuse floor (pale retina, myopic tessellation) so only
    the genuinely additive highlight survives.
    """
    _, _, r = circle
    diam = 2 * r

    mn = bgr.min(axis=2).astype(np.float32)

    # Fill outside-ROI with the in-ROI median so the blur is not dragged toward the black
    # surround or the bright barrel.
    fill = float(np.median(mn[roi > 0])) if (roi > 0).any() else 0.0
    mn_f = np.where(roi > 0, mn, fill).astype(np.float32)

    k = max(5, int(round(diam * cfg.baseline_frac)) | 1)
    k = min(k, 301)
    baseline = cv2.medianBlur(mn_f.astype(np.uint8), k).astype(np.float32)
    baseline = cv2.GaussianBlur(baseline, (0, 0), k * 0.25)

    resid = np.clip(mn_f - baseline, 0, None)
    resid[roi == 0] = 0.0
    return resid


def build_masks(bgr, roi, resid, circle, cfg):
    """Return (core_uint8, halo_float01, fringe_uint8)."""
    _, _, r = circle
    diam = 2 * r
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    v = hsv[..., 2]
    mn = bgr.min(axis=2)
    b, g, _ = cv2.split(bgr.astype(np.int16))

    # ── core: information is gone, only inpainting can fill it ──────────────
    # Two independent routes, and the brightness route needs a chaperone.
    #
    # min(R,G,B) >= core_min_chan is self-policing: if the darkest channel is at 150 the
    # saturation cannot exceed (255-150)/255, so a strongly coloured structure can never
    # trigger it. It needs no extra guard.
    #
    # V >= core_value does NOT have that property. The optic disc is a bright saturated
    # yellow-orange and clips V at 255, so a brightness-only rule inpaints the single most
    # diagnostically important structure in the frame — fatal for glaucoma, where the whole
    # signal is disc cupping. Require achromaticity alongside it: glare is the LED's white,
    # the disc is not.
    s_ch = hsv[..., 1]
    core = (((mn >= cfg.core_min_chan)
             | ((v >= cfg.core_value) & (s_ch <= cfg.core_sat_max))) & (roi > 0))
    core = core.astype(np.uint8) * 255

    # drop isolated specks (JPEG noise, dust on the lens)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(core)
    min_area = max(4, int(cfg.min_blob_frac * np.pi * r * r))
    keep = np.zeros_like(core)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            keep[lab == i] = 255
    core = keep

    kd = max(3, int(round(diam * cfg.core_dilate_frac)) | 1)
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((kd, kd), np.uint8))
    core = cv2.dilate(core, np.ones((kd, kd), np.uint8))
    core[roi == 0] = 0

    # ── halo: soft ramp, texture still recoverable by subtraction ───────────
    halo = np.clip((resid - cfg.halo_lo) / max(1e-6, cfg.halo_hi - cfg.halo_lo), 0, 1)
    halo = cv2.GaussianBlur(halo.astype(np.float32), (0, 0), max(1.0, diam * 0.006))
    halo[roi == 0] = 0.0

    # ── chromatic flare: the blue/purple ghost a clipped highlight leaves behind ─────
    # The LED's blue peak scatters inside the condensing lens and lands where the retina
    # has no blue signal at all, so B > G is a reliable flare flag on an orange fundus.
    blue = (b > g + cfg.fringe_delta) & (roi > 0)

    # Bright flare carries no retinal signal — inpaint it. Merely subtracting the achromatic
    # term here leaves a dark blue bruise, which is worse than the glare it replaced.
    hard = ((blue & (v > cfg.flare_value)).astype(np.uint8)) * 255
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n2, l2, st2, _ = cv2.connectedComponentsWithStats(hard)
    hkeep = np.zeros_like(hard)
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_AREA] >= min_area:
            hkeep[l2 == i] = 255
    hard = cv2.dilate(hkeep, np.ones((kd, kd), np.uint8))
    core = cv2.bitwise_or(core, hard)
    core[roi == 0] = 0

    # Faint flare keeps its texture — repair the chroma only, leave lightness alone.
    fringe = ((blue & (v <= cfg.flare_value)).astype(np.uint8)) * 255
    fringe = cv2.morphologyEx(fringe, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    fringe = cv2.dilate(fringe, np.ones((kd // 2 | 1, kd // 2 | 1), np.uint8))
    fringe[roi == 0] = 0
    fringe[core > 0] = 0

    return core, halo, fringe


# ══════════════════════════════════════════════════════════════════════════════
# Step 3 — repair
# ══════════════════════════════════════════════════════════════════════════════
def subtract_specular(bgr: np.ndarray, halo: np.ndarray, resid: np.ndarray,
                      cfg: DeglareConfig) -> np.ndarray:
    """Physics-based halo removal: the specular lobe is the illuminant's colour, so it adds
    the SAME amount to all three channels and can be subtracted the same way. Texture and
    vessels underneath survive — a mask-and-inpaint would have destroyed them.

    Subtract the RESIDUE, not the raw min-channel. The min-channel also contains the retina's
    legitimate diffuse floor; subtracting that leaves a dark, desaturated bruise exactly where
    the highlight used to be, which a classifier will happily learn as a lesion."""
    f = bgr.astype(np.float32)
    amount = (halo * resid * cfg.halo_strength)[..., None]
    return np.clip(f - amount, 0, 255)


def restore_chroma(bgr: np.ndarray, weight: np.ndarray, roi: np.ndarray,
                   circle, cfg: DeglareConfig) -> np.ndarray:
    """Put the diffuse colour back where the highlight bleached or tinted it.

    Subtracting the achromatic specular term fixes the brightness but not the hue: a clipped
    spot leaves a desaturated grey patch, and the LED's blue scatter leaves a lavender one.
    Under the dichromatic model the diffuse chromaticity is a property of the tissue, not of
    the lighting, so it can be borrowed from the surrounding retina. Work in LAB and touch
    only a/b — lightness carries the vessels and lesions and must survive untouched.
    """
    if weight.max() <= 0:
        return bgr
    _, _, r = circle
    k = max(5, int(round(2 * r * cfg.chroma_kernel_frac)) | 1)
    k = min(k, 99)

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L, A, B = cv2.split(lab)

    # Reference chroma from clean retina only: mask out the damaged pixels before blurring,
    # otherwise the bleached patch pollutes its own reference.
    good = ((weight < 0.15) & (roi > 0)).astype(np.float32)
    good = cv2.GaussianBlur(good, (0, 0), k * 0.35)
    for plane in "AB":
        pass
    def ref(ch):
        num = cv2.GaussianBlur(ch.astype(np.float32) * ((weight < 0.15) & (roi > 0)), (0, 0), k * 0.35)
        return num / np.maximum(good, 1e-3)

    A_ref, B_ref = ref(A), ref(B)
    w = np.clip(weight * cfg.chroma_strength, 0, 1).astype(np.float32)
    w = cv2.GaussianBlur(w, (0, 0), max(1.0, r * 0.01))
    w[roi == 0] = 0

    A = np.clip(A * (1 - w) + A_ref * w, 0, 255).astype(np.uint8)
    B = np.clip(B * (1 - w) + B_ref * w, 0, 255).astype(np.uint8)
    return cv2.cvtColor(cv2.merge([L, A, B]), cv2.COLOR_LAB2BGR)


def inpaint_core(bgr: np.ndarray, core: np.ndarray, circle, cfg: DeglareConfig) -> np.ndarray:
    if not core.any():
        return bgr
    _, _, r = circle
    rad = max(3, int(round(2 * r * cfg.inpaint_radius_frac)))
    flag = cv2.INPAINT_TELEA if cfg.inpaint_method == "telea" else cv2.INPAINT_NS
    return cv2.inpaint(bgr, core, rad, flag)


def flatten_illumination(bgr: np.ndarray, roi: np.ndarray, circle, cfg: DeglareConfig) -> np.ndarray:
    """Veiling-glare / uneven-illumination correction.

    Estimates the low-frequency luminance envelope inside the disc and divides it out,
    which removes the wash of light spilling across one side without touching the local
    contrast that carries the pathology. Operates on L in LAB so hue — which carries real
    diagnostic signal in fundus images — is untouched.
    """
    if not cfg.flatten or cfg.flatten_strength <= 0:
        return bgr
    _, _, r = circle
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0]

    m = roi > 0
    if not m.any():
        return bgr
    fill = float(np.median(L[m]))
    Lf = np.where(m, L, fill).astype(np.float32)

    sigma = max(3.0, 2 * r * cfg.flatten_sigma_frac)
    env = cv2.GaussianBlur(Lf, (0, 0), sigma)
    env = np.maximum(env, 1.0)

    target = float(np.median(env[m]))
    gain = np.clip(target / env, 0.55, 1.8)
    gain = 1.0 + (gain - 1.0) * cfg.flatten_strength

    lab[..., 0] = np.clip(L * gain, 0, 255)
    out = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
    return np.where(m[..., None], out, bgr)


# ══════════════════════════════════════════════════════════════════════════════
# Orchestration
# ══════════════════════════════════════════════════════════════════════════════
@dataclass
class Report:
    file: str = ""
    status: str = ""            # ok | review | reject | failed
    reason: str = ""
    width: int = 0
    height: int = 0
    disc_cx: int = 0
    disc_cy: int = 0
    disc_r: int = 0
    core_frac: float = 0.0      # fraction of disc destroyed by clipped glare
    halo_frac: float = 0.0      # fraction touched by soft specular subtraction
    macula_frac: float = 0.0    # fraction of the central zone glared
    fringe_frac: float = 0.0


def process_one(bgr: np.ndarray, cfg: DeglareConfig):
    """-> (clean_bgr | None, core_mask | None, Report)"""
    rep = Report(height=bgr.shape[0], width=bgr.shape[1])

    circle = find_disc(bgr, cfg)
    if circle is None:
        rep.status, rep.reason = "failed", "retinal disc not found"
        return None, None, rep
    cx, cy, r = circle
    rep.disc_cx, rep.disc_cy, rep.disc_r = cx, cy, r

    roi = disc_mask(bgr.shape, circle)
    roi_area = float((roi > 0).sum())

    work = remove_veil(bgr, roi, circle, cfg)
    resid = specular_map(work, roi, circle, cfg)
    core, halo, fringe = build_masks(work, roi, resid, circle, cfg)

    rep.core_frac = round(float((core > 0).sum()) / roi_area, 5)
    rep.halo_frac = round(float((halo > 0.05).sum()) / roi_area, 5)
    rep.fringe_frac = round(float((fringe > 0).sum()) / roi_area, 5)

    mac = np.zeros(bgr.shape[:2], np.uint8)
    cv2.circle(mac, (cx, cy), max(1, int(r * cfg.macula_radius_frac)), 255, -1)
    rep.macula_frac = round(float(((core > 0) & (mac > 0)).sum()) / max(1.0, (mac > 0).sum()), 5)

    # ── honesty gate: refuse to fabricate a diagnosis-bearing region ─────────
    if rep.core_frac > cfg.reject_frac:
        rep.status = "reject"
        rep.reason = f"glare covers {rep.core_frac:.1%} of the disc (limit {cfg.reject_frac:.0%})"
    elif rep.macula_frac > cfg.macula_reject_frac:
        rep.status = "reject"
        rep.reason = f"glare covers {rep.macula_frac:.1%} of the macular zone"
    elif rep.core_frac > cfg.review_frac:
        rep.status, rep.reason = "review", "large repair, check qc/ before training on this"
    else:
        rep.status = "ok"

    # ── repair chain ────────────────────────────────────────────────────────
    out = subtract_specular(work, halo, resid, cfg).astype(np.uint8)
    if cfg.fringe_repair:
        chroma_w = np.maximum(halo, (fringe > 0).astype(np.float32) * cfg.fringe_weight)
        out = restore_chroma(out, chroma_w, roi, circle, cfg)
    out = inpaint_core(out, core, circle, cfg)

    # Telea propagates colour inward from the hole boundary, which over a large blob converges
    # to a flat, slightly washed patch. One more chroma pass pulls the fill back onto the local
    # retinal hue so the repair does not read as a pale lesion to the classifier.
    if cfg.fringe_repair and core.any():
        soft = cv2.GaussianBlur((core > 0).astype(np.float32), (0, 0), max(1.0, r * 0.02))
        out = restore_chroma(out, soft * cfg.core_chroma_weight, roi, circle, cfg)

    out = flatten_illumination(out, roi, circle, cfg)
    out = np.where(roi[..., None] > 0, out, 0)          # blacken the barrel and the room

    if cfg.crop_to_disc:
        x0, x1 = max(0, cx - r), min(bgr.shape[1], cx + r)
        y0, y1 = max(0, cy - r), min(bgr.shape[0], cy + r)
        out = out[y0:y1, x0:x1]
        core = core[y0:y1, x0:x1]

    if cfg.out_size > 0:
        h, w = out.shape[:2]
        s = cfg.out_size / max(h, w)
        interp = cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC
        out = cv2.resize(out, (int(round(w * s)), int(round(h * s))), interpolation=interp)
        core = cv2.resize(core, out.shape[1::-1], interpolation=cv2.INTER_NEAREST)
        canvas = np.zeros((cfg.out_size, cfg.out_size, 3), np.uint8)
        cm = np.zeros((cfg.out_size, cfg.out_size), np.uint8)
        yo, xo = (cfg.out_size - out.shape[0]) // 2, (cfg.out_size - out.shape[1]) // 2
        canvas[yo:yo + out.shape[0], xo:xo + out.shape[1]] = out
        cm[yo:yo + core.shape[0], xo:xo + core.shape[1]] = core
        out, core = canvas, cm

    return out, core, rep


def make_qc(orig, clean, core, rep, width=1500):
    """before | after | mask, with the disc outlined on the original."""
    o = orig.copy()
    cv2.circle(o, (rep.disc_cx, rep.disc_cy), rep.disc_r, (0, 255, 0), 3)
    x0, x1 = max(0, rep.disc_cx - rep.disc_r), min(o.shape[1], rep.disc_cx + rep.disc_r)
    y0, y1 = max(0, rep.disc_cy - rep.disc_r), min(o.shape[0], rep.disc_cy + rep.disc_r)
    o = o[y0:y1, x0:x1]

    m = cv2.cvtColor(core, cv2.COLOR_GRAY2BGR)
    tiles, h = [], max(o.shape[0], clean.shape[0], m.shape[0])
    for t in (o, clean, m):
        s = h / t.shape[0]
        tiles.append(cv2.resize(t, (int(t.shape[1] * s), h)))
    sheet = np.hstack(tiles)
    s = width / sheet.shape[1]
    sheet = cv2.resize(sheet, (width, int(sheet.shape[0] * s)))

    for i, txt in enumerate(["BEFORE", "AFTER", "REPAIRED MASK"]):
        cv2.putText(sheet, txt, (12 + i * width // 3, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(sheet, f"{rep.status}  core={rep.core_frac:.2%}  macula={rep.macula_frac:.2%}",
                (12, sheet.shape[0] - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
    return sheet


# ══════════════════════════════════════════════════════════════════════════════
# Optional: multi-frame fusion — the only way to RECOVER rather than invent
# ══════════════════════════════════════════════════════════════════════════════
def fuse_group(paths: List[Path], cfg: DeglareConfig) -> Optional[np.ndarray]:
    """Align N frames of the same eye and take a glare-excluded median.

    Because you capture in video mode, the highlight moves between frames while the retina
    does not. Averaging with the glared pixels masked out fills each hole with REAL retina
    from another frame instead of interpolated guesswork. Use this whenever you have >=3
    usable frames of one eye — it beats every single-image method below.
    """
    imgs = [cv2.imread(str(p)) for p in paths]
    imgs = [i for i in imgs if i is not None]
    if len(imgs) < 2:
        return None

    ref = imgs[0]
    ref_g = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
    stack, wstack = [], []
    for im in imgs:
        if im.shape != ref.shape:
            im = cv2.resize(im, ref.shape[1::-1])
        if im is not imgs[0]:
            try:
                warp = np.eye(2, 3, dtype=np.float32)
                crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
                cv2.findTransformECC(ref_g, cv2.cvtColor(im, cv2.COLOR_BGR2GRAY),
                                     warp, cv2.MOTION_AFFINE, crit, None, 5)
                im = cv2.warpAffine(im, warp, ref.shape[1::-1],
                                    flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP)
            except cv2.error:
                continue
        c = find_disc(im, cfg)
        if c is None:
            continue
        roi = disc_mask(im.shape, c)
        resid = specular_map(im, roi, c, cfg)
        core, halo, _ = build_masks(im, roi, resid, c, cfg)
        w = np.clip(1.0 - halo, 0, 1)
        w[core > 0] = 0.0
        stack.append(im.astype(np.float32))
        wstack.append(w[..., None])

    if not stack:
        return None
    S, W = np.stack(stack), np.stack(wstack)
    num, den = (S * W).sum(0), W.sum(0)
    fused = np.where(den > 1e-3, num / np.maximum(den, 1e-3), S.mean(0))
    return np.clip(fused, 0, 255).astype(np.uint8)


# ══════════════════════════════════════════════════════════════════════════════
# Driver
# ══════════════════════════════════════════════════════════════════════════════
def run(in_dir: Path, out_dir: Path, cfg: DeglareConfig, fuse: bool = False,
        fuse_sep: str = "__") -> None:
    img_dir = out_dir / "images"
    msk_dir = out_dir / "masks"
    qc_dir = out_dir / "qc"
    rej_dir = out_dir / "rejected"
    for d in (img_dir, msk_dir, qc_dir, rej_dir):
        d.mkdir(parents=True, exist_ok=True)

    files = sorted(p for p in in_dir.rglob("*") if p.suffix.lower() in IMG_EXT)
    if not files:
        print(f"no images under {in_dir.resolve()}", file=sys.stderr)
        return
    print(f"{len(files)} image(s) under {in_dir.resolve()}")

    if fuse:
        groups = {}
        for p in files:
            groups.setdefault(p.stem.split(fuse_sep)[0], []).append(p)
        print(f"fusion mode: {len(groups)} group(s)")
        fused_dir = out_dir / "fused"
        fused_dir.mkdir(exist_ok=True)
        files = []
        for name, ps in sorted(groups.items()):
            f = fuse_group(ps, cfg)
            if f is None:
                print(f"  ! {name}: fusion failed, frames passed through individually")
                files.extend(ps)
                continue
            dst = fused_dir / f"{name}.png"
            cv2.imwrite(str(dst), f)
            files.append(dst)
            print(f"  + {name}: fused {len(ps)} frames")
        in_dir = fused_dir

    rows, counts = [], {"ok": 0, "review": 0, "reject": 0, "failed": 0}
    for p in files:
        bgr = cv2.imread(str(p))
        if bgr is None:
            r = Report(file=str(p), status="failed", reason="unreadable")
            rows.append(asdict(r)); counts["failed"] += 1
            continue

        try:
            clean, core, rep = process_one(bgr, cfg)
        except Exception as exc:                       # one corrupt file must not kill the run
            rep = Report(status="failed", reason=f"{type(exc).__name__}: {exc}")
            clean = core = None
        try:
            rel = p.relative_to(in_dir)
        except ValueError:
            rel = Path(p.name)
        rep.file = str(rel)
        rows.append(asdict(rep))
        counts[rep.status] = counts.get(rep.status, 0) + 1

        if clean is None:
            print(f"  ! {rel}: {rep.reason}")
            continue

        sheet = make_qc(bgr, clean, core, rep)
        qc_path = qc_dir / (rel.parent / f"{rel.stem}_qc.jpg")
        qc_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(qc_path), sheet, [cv2.IMWRITE_JPEG_QUALITY, 88])

        dst_root = rej_dir if rep.status == "reject" else img_dir
        dst = dst_root / rel.parent / f"{rel.stem}.jpg"
        dst.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(dst), clean, [cv2.IMWRITE_JPEG_QUALITY, cfg.jpeg_quality])

        mdst = msk_dir / rel.parent / f"{rel.stem}_mask.png"
        mdst.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(mdst), core)

        print(f"  {rep.status:<6} {rel}  core={rep.core_frac:.2%} macula={rep.macula_frac:.2%}")

    csv_path = out_dir / "glare_report.csv"
    with open(csv_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(Report().__dict__.keys()))
        w.writeheader()
        w.writerows(rows)

    print("\n" + "─" * 62)
    print(f"ok {counts['ok']} | review {counts['review']} | reject {counts['reject']} "
          f"| failed {counts['failed']}")
    print(f"clean images -> {img_dir.resolve()}")
    print(f"eyeball       -> {qc_dir.resolve()}")
    print(f"report        -> {csv_path.resolve()}")


def main():
    ap = argparse.ArgumentParser(description="Glare removal for smartphone fundus photographs.")
    ap.add_argument("--in", dest="in_dir", default="personal_dataset/raw")
    ap.add_argument("--out", dest="out_dir", default="personal_dataset/clean")
    ap.add_argument("--size", type=int, default=0, help="square output side in px (0 = native)")
    ap.add_argument("--no-flatten", action="store_true", help="skip illumination flattening")
    ap.add_argument("--no-crop", action="store_true", help="keep the full frame")
    ap.add_argument("--inpaint", choices=["telea", "ns"], default="telea")
    ap.add_argument("--halo-strength", type=float, default=0.85)
    ap.add_argument("--reject-frac", type=float, default=0.08)
    ap.add_argument("--fuse", action="store_true", help="multi-frame fusion mode")
    ap.add_argument("--fuse-sep", default="__", help="filename separator before the frame index")
    a = ap.parse_args()

    cfg = DeglareConfig(
        out_size=a.size,
        flatten=not a.no_flatten,
        crop_to_disc=not a.no_crop,
        inpaint_method=a.inpaint,
        halo_strength=a.halo_strength,
        reject_frac=a.reject_frac,
    )
    run(Path(a.in_dir), Path(a.out_dir), cfg, fuse=a.fuse, fuse_sep=a.fuse_sep)


if __name__ == "__main__":
    main()
