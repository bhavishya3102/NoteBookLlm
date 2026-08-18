# Manthan — brand aur theme spec

> **Manthan** (मंथन) = *the churn*. Samudra Manthan me devas aur asuras ne samudra ko
> mathha tha amrit nikalne ke liye. Yahi is product ka kaam hai: raw sources (PDF, website,
> YouTube, notes) ko mathhna, aur unme se **amrit** — samjha hua, cited knowledge — nikalna.
>
> Tagline: **"Everything you have read, answering back."**

Naam kyun kaam karta hai:
- **Unique** — AI notebook space me koi "Manthan" nahi hai (NotebookLM, Notion AI, Mem, Recall sab flat descriptive names hain).
- **Meaning built in** — churn = chunking + retrieval + synthesis. Product ka mechanism hi naam me hai.
- **Visual language free me milta hai** — rassi ke coils, ghoomta axis. Logo mark aur hero motion isi se aaya.
- **Pronounce karna aasan** — MAN-than, 2 syllables, spelling ambiguity nahi.

Runner-ups (agar kabhi rename karna ho): **Steep** (chai-adjacent, "sources steeping into insight"),
**Colophon** (kitaab ke aakhir ka printer's note — editorial, thoda obscure).

> Rename ka scope: sirf user-facing strings badle hain. `chaibook-505009` (GCP project),
> `chaibook-chat-preferences` (zustand persist key) waise hi hain — inhe chhedne ki zaroorat nahi.

---

## 1. Aesthetic direction — "Ink & Amrit"

Ek **archival instrument**: purana manuscript + precise scientific tool. Kaagaz ki warmth,
hairline rules, editorial asymmetry — lekin data-dense aur crisp. AI-slop wale purple gradient,
glassmorphism cards, aur Inter/Space Grotesk ka bilkul ulta.

| Mode | Naam | Kya hai |
|---|---|---|
| Light | **Parchment** | Warm paper background, burnt copper accents. Din me padhne ke liye. |
| Dark | **Abyss** | Deep ocean-ink indigo, amrit gold accents. Wahi samudra jise mathha gaya. |

Dono modes me ek hi cheez common hai: **paper grain** (`body::after`, SVG turbulence) —
yeh texture hi brand ka fingerprint hai.

---

## 2. Color tokens

Sab kuch oklch me hai, `client/app/globals.css` me. shadcn ke naam hi use kiye hain,
plus ek naya token: `citation`.

### Parchment (light)

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.972 0.008 79)` | warm paper, pure white nahi |
| `--foreground` | `oklch(0.215 0.021 52)` | warm ink (black nahi) |
| `--primary` | `oklch(0.505 0.128 47)` | **burnt copper** — CTA, focus ring, numerals |
| `--citation` | `oklch(0.455 0.078 195)` | **verified-source teal** — sirf citations ke liye |
| `--muted-foreground` | `oklch(0.512 0.021 58)` | secondary text |
| `--border` | `oklch(0.882 0.012 76)` | hairline rules |
| `--radius` | `0.5rem` | pehle 0.875rem tha — crisper, kam "bubbly" |

### Abyss (dark)

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.178 0.019 268)` | deep ocean ink |
| `--card` | `oklch(0.222 0.021 266)` | uthaya hua surface |
| `--primary` | `oklch(0.792 0.135 74)` | **amrit gold** |
| `--citation` | `oklch(0.742 0.098 194)` | teal, dark pe bright |
| `--sidebar` | `oklch(0.152 0.018 268)` | background se **gehra** — recessed rail |

**Rule:** teal (`citation`) sirf grounded citations pe. Jab teal dikhe, matlab "yeh line source
se aayi hai". Isko decoration ke liye kabhi use na karo — warna signal marr jayega.

---

## 3. Typography — 4 fonts, har ek ka ek kaam

| Role | Font | Token / class | Kahan |
|---|---|---|---|
| Display | **Fraunces** | `font-display` | page h1, brand wordmark, `01/02/03` numerals |
| UI chrome | **Familjen Grotesk** | `font-sans` (default), `font-heading` | buttons, labels, nav, card titles |
| Reading | **Newsreader** | `.reading-surface` | LLM answers, summaries, reports — jo padha jaata hai |
| Metadata | **JetBrains Mono** | `font-mono`, `.eyebrow` | citations, source types, model ids, timestamps |

Do decisions jo deliberate hain:

1. **`html` pe se `font-mono` hataya** — pehle poori app monospace thi. Ab mono sirf metadata ke
   liye reserved hai, isliye jab mono dikhta hai to woh *matlab* rakhta hai.
2. **Answers serif me** (`.reading-surface` → Newsreader, 1.0125rem / 1.7) — har AI chat app sans
   use karti hai. Reading product me serif = kam aankh thakti hai, aur turant distinct lagta hai.

---

## 4. Motion

Kam, lekin orchestrated. Sab CSS-only, `prefers-reduced-motion` respected (globals.css me guard hai).

| Animation | Kaam |
|---|---|
| `animate-rise` | page load pe staggered reveal (`animationDelay` inline: 80 → 420ms) |
| `animate-churn-slow / mid / fast` | 64s / 38s / 22s — ulti directions me ghoomte coils = the churn |
| `animate-bloom` | center pivot ka dheema pulse |

Hero ka signature moment: **teen coils opposite directions me ghoom rahe hain** — devas ek taraf,
asuras doosri taraf. Rope hilta hai, mountain ghoomta hai.

---

## 5. Components

- `shared/components/brand/manthan-mark.tsx`
  - `<ManthanMark animated />` — coils + pivot. App chrome me `animated` **na** do.
  - `<ManthanWordmark size="sm|md|lg" />` — mark + Fraunces wordmark.
- `.eyebrow` — mono uppercase 0.18em tracking. Section labels ke liye.
- `.numerals` — Fraunces tabular numerals. Steps, counts, metrics.
- `shadow-plate` / `shadow-lift` — do hi elevation levels. Beech me kuch nahi.

---

## 6. Kya nahi karna

- ❌ Emoji ko brand mark ki tarah use karna (📚 hata diya gaya hai — workspace icons theek hain).
- ❌ Copper/gold ko bade area pe bharna. Yeh accent hai, surface nahi.
- ❌ Teal ko citations ke alawa kahin use karna.
- ❌ Pure white (`#fff`) ya pure black (`#000`) — dono palettes warm/cool tinted hain.
- ❌ Naya font add karna. Chaar kaafi hain.
- ❌ Display serif ko chhote UI text (< 16px) pe lagana. Fraunces heading ka font hai.
