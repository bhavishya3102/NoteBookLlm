/**
 * Per-workspace accent hues. These sit inside the "Ink & Amrit" palette —
 * same lightness/chroma family as --primary and --citation — so a wall of
 * notebooks reads as one set of plates rather than eight loud gradients.
 */
const ACCENTS = [
    "oklch(0.505 0.128 47)", // terracotta — the primary
    "oklch(0.455 0.078 195)", // teal — the citation ink
    "oklch(0.505 0.098 148)", // leaf
    "oklch(0.575 0.118 62)", // amber
    "oklch(0.470 0.105 15)", // brick
    "oklch(0.470 0.090 280)", // indigo
] as const;

function hashString(value: string) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }

    return Math.abs(hash);
}

export function getWorkspaceAccent(workspaceId: string) {
    return ACCENTS[hashString(workspaceId) % ACCENTS.length];
}
