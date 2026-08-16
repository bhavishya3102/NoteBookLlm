import type { Request, Response } from "express";
import {
    createArtifactForWorkspace,
    deleteArtifactForWorkspace,
    getArtifactForWorkspace,
    listArtifactsForWorkspace,
} from "../services/artifact.service.js";
import {
    artifactIdParamSchema,
    createArtifactSchema,
} from "../validators/artifact.validator.js";
import { workspaceIdParamSchema } from "../validators/workspace.validator.js";


// 1. Validate — galat data yahin ruk jaata hai
// Schema (artifact.validator.ts:17-21): 


// z.object({
//     type: z.enum(artifactTypes),                        // required, fixed list
//     title: z.string().trim().min(1).max(120).optional(),
//     sourceIds: z.array(z.string().trim().min(1)).optional(),
// })
// Client bheje:


// { "type": "PIZZA" }
// parse turant ZodError throw kar dega. Service function, Prisma, DB — kisi tak request pahunchegi hi nahi.

// Agar ye line na hoti, "PIZZA" seedha Prisma enum column pe jaata → DB error → user ko 500 Internal Server Error. Jabki galti user ki thi, server ki nahi.

// 2. Transform — .trim() sirf check nahi, badalta hai

// { "type": "QUIZ", "title": "   Chapter 1   " }
// input.title ban jaata hai "Chapter 1" — spaces hate hue. Ye parse ka return value hai, isliye req.body use karne ke bajaye input variable use karna zaroori hai. req.body.title mein abhi bhi spaces padi hain.

// Isi wajah se line 39 pe input pass hota hai, req.body nahi.

// 3. Type inference — input ka type free mein mil jaata hai
// req.body ka type Express mein any hota hai — TypeScript kuch nahi pakadta:


// req.body.tpye         // typo, compiler chup hai
// req.body.type === "PIZZA"  // compiler chup hai
// parse ke baad input ka type automatically ye ban jaata hai:


// { type: "SUMMARY" | "TAKEAWAYS" | "FLASHCARDS" | "QUIZ" | "MINDMAP" | "REPORT";
//   title?: string;
//   sourceIds?: string[]; }
// Ab input.tpye likha toh compile error. Ye wahi type hai jo artifact.validator.ts:23 pe CreateArtifactInput ke naam se export hai — schema aur type kabhi out-of-sync nahi ho sakte, kyunki type schema se hi nikla hai.

// 4. parse (throw) vs safeParse (return) — yahan throw hi sahi hai
// Zod mein do options hain:


// // Option A — jo yahan use hua
// const input = createArtifactSchema.parse(req.body);   // galat hua toh throw

// // Option B
// const result = createArtifactSchema.safeParse(req.body);
// if (!result.success) {
//     return res.status(400).json({ error: "Validation failed", details: ... });
// }
// const input = result.data;
// Option B har controller mein 4 extra lines maangta hai. Is codebase mein wo boilerplate ek jagah centralize hai:

// Route asyncHandler se wrapped hai (async-handler.ts:29-33) → thrown error next(err) tak pahunchta hai
// error-handler.middleware.ts:20-26 ZodError ko pakadta hai aur ye bhejta hai:

// {
//   "error": "Validation failed",
//   "details": { "type": ["Invalid option: expected one of \"SUMMARY\"|..."] }
// }
// status 400.

// Yaani parse ka throw bug nahi, design hai — har controller apna error response likhne ke bajaye bas parse bulata hai, aur ek middleware sabke liye consistent 400 bhejta hai.

// Poora flow — ek galat request pe

// POST /workspaces/ws_1/artifacts   body: { "type": "PIZZA" }
//    ↓
// line 34: workspaceIdParamSchema.parse(req.params)   ✅ ws_1 valid
//    ↓
// line 35: createArtifactSchema.parse(req.body)       ❌ throw ZodError
//    ↓
// asyncHandler → .catch(next)
//    ↓
// errorHandler → 400 { error: "Validation failed", details: {...} }



export async function listArtifacts(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const artifacts = await listArtifactsForWorkspace(
        workspaceId,
        req.session.user.id,
    );
    res.json(artifacts);
}

// Get call ke case mein —
export async function getArtifact(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    const artifact = await getArtifactForWorkspace(
        workspaceId,
        artifactId,
        req.session.user.id,
    );
    res.json(artifact);
}

// Post call ke case mein —
export async function createArtifact(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const input = createArtifactSchema.parse(req.body);
    const artifact = await createArtifactForWorkspace(
        workspaceId,
        req.session.user.id,
        input,
    );
    res.status(201).json(artifact);
}

export async function deleteArtifact(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    await deleteArtifactForWorkspace(
        workspaceId,
        artifactId,
        req.session.user.id,
    );
    res.status(204).send();
}
