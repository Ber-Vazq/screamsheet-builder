import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { insertScreamsheetSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Save a screamsheet -> returns the row with its share id
  app.post("/api/screamsheets", async (req, res) => {
    const parsed = insertScreamsheetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const sheet = await storage.createScreamsheet(parsed.data);
    res.json(sheet);
  });

  // Read a shared screamsheet by id (public; owner key is stripped from response)
  app.get("/api/screamsheets/:id", async (req, res) => {
    const sheet = await storage.getScreamsheet(req.params.id);
    if (!sheet) return res.status(404).json({ error: "Not found" });
    const { ownerKey, ...safe } = sheet as any;
    res.json(safe);
  });

  // List ONLY the sheets owned by the GM key in ?owner=. No key -> empty list.
  app.get("/api/screamsheets", async (req, res) => {
    const owner = String(req.query.owner ?? "").trim();
    const sheets = await storage.listScreamsheets(owner);
    const safe = sheets
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ ownerKey, ...rest }: any) => rest);
    res.json(safe);
  });

  // Update a screamsheet in place, only if the GM key matches
  app.put("/api/screamsheets/:id", async (req, res) => {
    const owner = String(req.query.owner ?? "").trim();
    const parsed = insertScreamsheetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = await storage.updateScreamsheet(req.params.id, owner, parsed.data);
    if (result === "notfound") return res.status(404).json({ error: "Not found" });
    if (result === "forbidden")
      return res.status(403).json({ error: "This screamsheet belongs to a different GM key." });
    const { ownerKey, ...safe } = result as any;
    res.json(safe);
  });

  // Delete a screamsheet, only if the GM key matches
  app.delete("/api/screamsheets/:id", async (req, res) => {
    const owner = String(req.query.owner ?? "").trim();
    const result = await storage.deleteScreamsheet(req.params.id, owner);
    if (result === "notfound") return res.status(404).json({ error: "Not found" });
    if (result === "forbidden")
      return res.status(403).json({ error: "This screamsheet belongs to a different GM key." });
    res.json({ ok: true });
  });

  return httpServer;
}
