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

  // Read a shared screamsheet by id
  app.get("/api/screamsheets/:id", async (req, res) => {
    const sheet = await storage.getScreamsheet(req.params.id);
    if (!sheet) return res.status(404).json({ error: "Not found" });
    res.json(sheet);
  });

  // List saved screamsheets (the GM's library)
  app.get("/api/screamsheets", async (_req, res) => {
    const sheets = await storage.listScreamsheets();
    res.json(sheets.sort((a, b) => b.createdAt - a.createdAt));
  });

  // Delete a screamsheet
  app.delete("/api/screamsheets/:id", async (req, res) => {
    const ok = await storage.deleteScreamsheet(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  return httpServer;
}
