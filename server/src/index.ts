import "dotenv/config";
import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

const app = express();
const port = process.env.PORT ?? 8080;
const clientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(
    cors({
        origin: clientUrl,
        credentials: true,
    }),
);
app.use(express.json());


app.get("/", (_req, res) => {
    res.json({ message: "Hello from Chaibook API" });
});

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});