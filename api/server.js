/**
 * server.js
 * ---------
 * API REST (Backend) que desacopla el scraper de la persistencia en Supabase.
 *
 * Endpoints:
 *   POST /api/items  -> recibe payload del scraper, valida e inserta en Supabase
 *   GET  /api/items   -> retorna el listado completo ordenado cronológicamente
 *
 * Requisitos:
 *   npm install express @supabase/supabase-js cors dotenv
 *
 * Variables de entorno (.env):
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (NUNCA exponer esta key al frontend)
 *   PORT=3000
 *   SCRAPER_API_KEY=...             (opcional, para autenticar al scraper)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// -----------------------------------------------------------------
// Configuración e inicialización
// -----------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[FATAL] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno."
  );
  process.exit(1);
}

// Cliente de Supabase usando la service_role key: esto es lo que permite
// al backend saltarse RLS de forma controlada y ser el único punto de
// escritura autorizado.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// -----------------------------------------------------------------
// Middleware simple de autenticación para el scraper (opcional)
// -----------------------------------------------------------------
function authenticateScraper(req, res, next) {
  if (!SCRAPER_API_KEY) return next(); // si no se configuró, no se exige
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== SCRAPER_API_KEY) {
    return res.status(401).json({ error: "No autorizado." });
  }
  next();
}

// -----------------------------------------------------------------
// Validación del payload
// -----------------------------------------------------------------
function validateItems(body) {
  if (!body || !Array.isArray(body.items)) {
    return { valid: false, error: "El payload debe tener un arreglo 'items'." };
  }
  if (body.items.length === 0) {
    return { valid: false, error: "El arreglo 'items' no puede estar vacio." };
  }

  for (const [index, item] of body.items.entries()) {
    if (typeof item.title !== "string" || item.title.trim() === "") {
      return { valid: false, error: `Item ${index}: 'title' es requerido y debe ser texto.` };
    }
    if (typeof item.link !== "string" || item.link.trim() === "") {
      return { valid: false, error: `Item ${index}: 'link' es requerido y debe ser texto.` };
    }
    if (item.metadata && typeof item.metadata !== "object") {
      return { valid: false, error: `Item ${index}: 'metadata' debe ser un objeto.` };
    }
  }

  return { valid: true };
}

// -----------------------------------------------------------------
// POST /api/items — inserción masiva
// -----------------------------------------------------------------
app.post("/api/items", authenticateScraper, async (req, res) => {
  const { valid, error } = validateItems(req.body);
  if (!valid) {
    return res.status(400).json({ error });
  }

  const rows = req.body.items.map((item) => ({
    title: item.title,
    link: item.link,
    metadata: item.metadata || {},
    source: item.source || "unknown",
  }));

  // upsert evita duplicados exactos (link+source) definidos en el indice unico
  const { data, error: dbError } = await supabase
    .from("scraped_items")
    .upsert(rows, { onConflict: "link,source", ignoreDuplicates: true })
    .select();

  if (dbError) {
    console.error("[DB ERROR]", dbError.message);
    return res.status(500).json({ error: "Error al insertar en la base de datos." });
  }

  return res.status(201).json({
    message: "Registros procesados correctamente.",
    inserted: data?.length ?? 0,
    items: data,
  });
});

// -----------------------------------------------------------------
// GET /api/items — listado cronológico completo
// -----------------------------------------------------------------
app.get("/api/items", async (req, res) => {
  const { data, error: dbError } = await supabase
    .from("scraped_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("[DB ERROR]", dbError.message);
    return res.status(500).json({ error: "Error al consultar la base de datos." });
  }

  return res.status(200).json({ count: data.length, items: data });
});

// -----------------------------------------------------------------
// Healthcheck
// -----------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// -----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
