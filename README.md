# Taller: Solución Web Scraper → API → Supabase → Frontend (Santiago Sabogal Millan)

## Arquitectura

```
[scraper.py] --POST--> [server.js / Express] --insert/select--> [Supabase (Postgres)]
                              ^                                        |
                              |                                        v
                        GET /api/items <----------------- [index.html / fetch GET]
```

## Estructura del proyecto

```
proyecto/
├── scripts/
│   ├── scraper.py
│   ├── requirements.txt
│   └── .env.example
├── api/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── database/
│   └── schema.sql
└── frontend/
    └── index.html
```

## 1. Configurar Supabase

1. Crea un proyecto en https://supabase.com.
2. Ve a **SQL Editor** y ejecuta el contenido de `database/schema.sql`. Esto crea:
   - la tabla `scraped_items` (id, title, link, metadata, source, created_at)
   - las políticas RLS (lectura pública, escritura solo vía `service_role`)
3. En **Project Settings > API** copia:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` (secreta, NO la anon key) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Levantar el backend (server.js)

```bash
cd api
cp .env.example .env    # completa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

El servidor queda escuchando en `http://localhost:3000`.

Endpoints:
- `POST /api/items` — recibe `{ "items": [ { title, link, metadata, source }, ... ] }`
- `GET /api/items` — retorna `{ count, items }` ordenado por `created_at` descendente
- `GET /api/health` — healthcheck

## 3. Ejecutar el scraper (scraper.py)

```bash
cd scripts
python3 -m venv venv && source venv/bin/activate   # opcional pero recomendado
pip install -r requirements.txt
cp .env.example .env    # ajusta SCRAPER_TARGET_URL si usas otra fuente
python scraper.py
```

Por defecto apunta a `https://quotes.toscrape.com/` (sitio de práctica) como
placeholder. Para tu fuente real:
1. Cambia `SCRAPER_TARGET_URL` en `.env`.
2. Ajusta los selectores CSS en la función `parse_items()` dentro de
   `scraper.py` según la estructura HTML de tu sitio objetivo.

## 4. Ver el frontend (index.html)

Abre `frontend/index.html` directamente en el navegador, o sírvelo con:

```bash
cd frontend
python3 -m http.server 5500
```

Si tu backend corre en otro host/puerto, actualiza la constante
`API_BASE_URL` al inicio del `<script>` en `index.html`.

## Flujo completo de prueba

1. Backend corriendo (`npm start` en `api/`).
2. Ejecutar `python scraper.py` → debería loguear cuántos items envió y el
   status 201 de la API.
3. Abrir `index.html` → pulsar "Actualizar" → deberías ver las tarjetas con
   los registros recién insertados.

## Notas de seguridad

- La `service_role key` de Supabase **solo** vive en el backend (`.env`),
  nunca en el frontend ni en el scraper.
- El `SCRAPER_API_KEY` es opcional: si lo defines en ambos `.env`
  (backend y scraper), el endpoint `POST /api/items` exigirá el header
  `Authorization: Bearer <key>`.
- El índice único `(link, source)` + `upsert(..., ignoreDuplicates: true)`
  evita que correr el scraper varias veces duplique registros.
