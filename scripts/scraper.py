"""
scraper.py
----------
Módulo de Web Scraping.

Responsabilidades:
1. Realizar peticiones HTTP a la fuente web objetivo.
2. Parsear el HTML y extraer elementos clave (titulo, enlace, metadatos).
3. Empaquetar los resultados en JSON.
4. Enviar (POST) el payload a la API central (server.js).

Requisitos:
    pip install requests beautifulsoup4 python-dotenv

Uso:
    python scraper.py
"""

import os
import sys
import time
import logging
from dataclasses import dataclass, asdict
from typing import List, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------
TARGET_URL = os.getenv("SCRAPER_TARGET_URL", "https://quotes.toscrape.com/")
API_ENDPOINT = os.getenv("API_ENDPOINT", "http://localhost:3000/api/items")
API_KEY = os.getenv("SCRAPER_API_KEY", "")  # opcional, para autenticar contra el backend
SOURCE_NAME = os.getenv("SOURCE_NAME", "quotes.toscrape.com")
REQUEST_TIMEOUT = 15
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("scraper")


@dataclass
class ScrapedItem:
    title: str
    link: str
    metadata: dict
    source: str


# ---------------------------------------------------------------
# 1. Extracción (fetch + parse)
# ---------------------------------------------------------------
def fetch_html(url: str) -> Optional[str]:
    """Descarga el HTML de la URL objetivo con reintentos simples."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; TallerScraperBot/1.0; +https://example.com/bot)"
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            logger.warning("Intento %s/%s fallido al descargar %s: %s", attempt, MAX_RETRIES, url, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    logger.error("No se pudo descargar %s tras %s intentos.", url, MAX_RETRIES)
    return None


def parse_items(html: str, base_url: str) -> List[ScrapedItem]:
    """
    Extrae elementos estructurados del HTML.

    NOTA: Los selectores de abajo funcionan para quotes.toscrape.com
    (sitio de práctica). Para tu fuente real, ajusta los selectores
    de BeautifulSoup según la estructura del sitio objetivo.
    """
    soup = BeautifulSoup(html, "html.parser")
    items: List[ScrapedItem] = []

    for quote_block in soup.select(".quote"):
        text_el = quote_block.select_one(".text")
        author_el = quote_block.select_one(".author")
        author_link_el = quote_block.select_one("a")  # link al detalle del autor
        tags = [tag.get_text(strip=True) for tag in quote_block.select(".tag")]

        if not text_el or not author_el:
            continue

        title = text_el.get_text(strip=True)
        author = author_el.get_text(strip=True)
        link = requests.compat.urljoin(base_url, author_link_el["href"]) if author_link_el else base_url

        items.append(
            ScrapedItem(
                title=title,
                link=link,
                metadata={"author": author, "tags": tags},
                source=SOURCE_NAME,
            )
        )

    return items


# ---------------------------------------------------------------
# 2. Integración: empaquetar y enviar a la API
# ---------------------------------------------------------------
def send_to_api(items: List[ScrapedItem]) -> bool:
    """Empaqueta los items en JSON y los envía por POST al backend."""
    if not items:
        logger.info("No hay items para enviar.")
        return True

    payload = {"items": [asdict(item) for item in items]}
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"

    try:
        response = requests.post(
            API_ENDPOINT, json=payload, headers=headers, timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        logger.info(
            "Envio exitoso: %s items -> %s (status %s)",
            len(items), API_ENDPOINT, response.status_code
        )
        return True
    except requests.RequestException as exc:
        logger.error("Error enviando datos a la API: %s", exc)
        return False


# ---------------------------------------------------------------
# 3. Orquestación
# ---------------------------------------------------------------
def run():
    logger.info("Iniciando ciclo de scraping sobre %s", TARGET_URL)
    html = fetch_html(TARGET_URL)
    if html is None:
        sys.exit(1)

    items = parse_items(html, TARGET_URL)
    logger.info("Se extrajeron %s registros.", len(items))

    success = send_to_api(items)
    if not success:
        sys.exit(1)

    logger.info("Ciclo de scraping finalizado correctamente.")


if __name__ == "__main__":
    run()
