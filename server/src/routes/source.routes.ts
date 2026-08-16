import { Router } from "express";
import {
    bulkDeleteSources,
    createSource,
    deleteSource,
    getSource,
    getSourceChunks,
    importWebSearch,
    importWebsite,
    importYoutube,
    listSources,
    reprocessSource,
    reprocessSources,
    uploadPdf,
} from "../controllers/source.controller.js";
import { uploadSinglePdf } from "../middleware/upload.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
// Do routers hain — parent aur child:


// // PARENT
// const workspaceRoutes = Router();

// // CHILD
// const sourceRoutes = Router();          // <-- abhi mergeParams NAHI hai

// // Child ko parent ke andar mount kiya
// workspaceRoutes.use("/:workspaceId/sources", sourceRoutes);
// //                    ^^^^^^^^^^^^ ye PARENT ne pakda

// sourceRoutes.get("/:sourceId", (req, res) => {
// //                 ^^^^^^^^^ ye CHILD ne pakda
//     console.log(req.params);
// });

// app.use("/api/workspaces", workspaceRoutes);
// Ab request maaro

// GET /api/workspaces/w1/sources/s1
// URL do hisso me tootta hai:


// /api/workspaces  /  w1        /sources/  s1
//      ↑               ↑                    ↑
//    app mount    parent ne pakda      child ne pakda
//                 (:workspaceId)        (:sourceId)
// Bina mergeParams ke console me print hoga:


// { sourceId: "s1" }        // ❌ workspaceId gayab!
// workspaceId URL me maujood hai, lekin child router use dekh nahi paata — kyunki wo parent ne match kiya tha, child ne nahi.

// Ab mergeParams: true laga do:


// const sourceRoutes = Router({ mergeParams: true });
// Wahi request, ab print hoga:


// { workspaceId: "w1", sourceId: "s1" }   // ✅ dono mil gaye
// Tumhare code me kya toot-ta
// source.controller.ts:41:


// const { workspaceId, sourceId } = sourceIdParamSchema.parse(req.params);
// Zod schema dono maang raha hai. Agar mergeParams hata do → workspaceId undefined aayega → parse() throw karega → har source API 400/500 dene lagegi. Isliye line 19 pe wo flag zaroori hai.

// Ek line me
// Express by default child router ko parent ke params nahi deta. mergeParams: true = "bhai, parent ne jo params pakde the wo bhi mujhe de do."


export const sourceRoutes = Router({ mergeParams: true });

sourceRoutes.get("/", asyncHandler(listSources));
sourceRoutes.post("/", asyncHandler(createSource));
sourceRoutes.post(
    "/upload",
    uploadSinglePdf,
    asyncHandler(uploadPdf),
);
sourceRoutes.post("/import/website", asyncHandler(importWebsite));
sourceRoutes.post("/import/youtube", asyncHandler(importYoutube));
sourceRoutes.post("/import/web-search", asyncHandler(importWebSearch));
sourceRoutes.post("/bulk-delete", asyncHandler(bulkDeleteSources));
sourceRoutes.post("/reprocess", asyncHandler(reprocessSources));
sourceRoutes.get("/:sourceId/chunks", asyncHandler(getSourceChunks));
sourceRoutes.get("/:sourceId", asyncHandler(getSource));
sourceRoutes.post("/:sourceId/reprocess", asyncHandler(reprocessSource));
sourceRoutes.delete("/:sourceId", asyncHandler(deleteSource));
