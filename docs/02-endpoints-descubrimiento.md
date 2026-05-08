# Kickertech API — Parte 2: Endpoints de Descubrimiento (JSON)

> **Alcance**: los 4 endpoints REST que devuelven JSON y sirven para **navegar el catálogo** (sports → countries → tournaments → events). No requieren `configId/configHash`, sólo IP whitelisteada.

**Host base**: `https://affiliates.websbkt.com`
**Método**: `GET` en todos los casos
**Auth**: IP whitelist (no hay header de Authorization)
**Content-Type respuesta**: `application/json`

---

## Endpoint 1 — Get Sports List

### URL
```
GET https://affiliates.websbkt.com/sports
```

### Parámetros
Ninguno.

### Respuesta
Array de objetos `Sport`.

**Schema:**
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID del deporte. Se usa en todos los endpoints siguientes. |
| `name` | `string` (max 255) | Nombre legible del deporte. |

> ⚠️ **Inconsistencia documental**: el PDF a veces lo llama `Title` (en la tabla) y a veces `name` (en el ejemplo). El **JSON real usa `name`**. Programar contra `name`.

### Ejemplo de respuesta
```json
[
  { "id": 4, "name": "Ice Hockey" },
  { "id": 6, "name": "Baseball" },
  { "id": 7, "name": "Volleyball" },
  { "id": 8, "name": "Futsal" }
]
```

### Casos de uso
- Construir el **catálogo maestro de deportes** que Kickertech soporta.
- Filtrar deportes que NO nos interesan antes de seguir descendiendo (ej: si Minuto90 sólo cubre fútbol, sólo seguir con `id` de fútbol).
- Detectar deportes nuevos que Kickertech haya agregado.

### Estrategia de cache
- **TTL muy alto** (12–24 horas). El catálogo de deportes prácticamente no cambia.
- Almacenar en una tabla `kickertech_sports` con `id`, `name`, `last_seen_at`.

---

## Endpoint 2 — Get Countries List

### URL
```
GET https://affiliates.websbkt.com/{sportId}/countries
```

### Parámetros (path)
| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `sportId` | `int` | ✅ | ID obtenido de `/sports`. |

### Respuesta
Array de objetos `Country`.

**Schema:**
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID del país/región. |
| `name` | `string` (max 255) | Nombre del país o región. |

> ⚠️ Ojo: Kickertech mezcla **países reales** ("Argentina", "Vietnam") con **regiones agregadoras** ("Europe", "World", "North America"). Tratar a ambos uniformemente como "country" — es la abstracción que ellos usan para agrupar torneos.

### Ejemplo de respuesta
```json
[
  { "id": 17, "name": "Europe" },
  { "id": 18, "name": "World" },
  { "id": 27, "name": "North America" },
  { "id": 72, "name": "Australia" },
  { "id": 161, "name": "Vietnam" }
]
```

### Casos de uso
- Construir submenú geográfico de torneos por deporte.
- Limitar el scope del crawling. En vez de descargar el feed completo, podemos limitarlo a países concretos.
- Reconciliar con el campo `country` que devuelve api-football para sus ligas (clave para el mapeo).

### Estrategia de cache
- **TTL alto** (6–24 horas). Cambia muy poco.
- Tabla `kickertech_countries` con FK a `sportId`.

---

## Endpoint 3 — Get Tournaments List

### URL
```
GET https://affiliates.websbkt.com/{sportId}/{countryId}/tournaments
```

### Multi-país (importante)
Soporta **lista de países separados por coma**:
```
GET https://affiliates.websbkt.com/6/27,155,167/tournaments
```
Esto devuelve los torneos de los tres países en una sola request — útil para reducir round-trips.

### Parámetros (path)
| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `sportId` | `int` | ✅ | |
| `countryId` | `int` o `int,int,int` | ✅ | Uno o varios IDs separados por coma. |

### Respuesta
Array de objetos `Tournament`.

**Schema:**
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID del torneo. |
| `name` | `string` (max 255) | Nombre del torneo. |

### Ejemplo de respuesta
```json
[
  { "id": 102, "name": "MLB" },
  { "id": 4374, "name": "KPB" }
]
```

### Casos de uso
- **Punto crítico para el mapeo con api-football**. Aquí es donde tenemos que decidir, para cada torneo de Kickertech, a qué `league_id` de api-football corresponde.
- Construir un **selector de ligas** en el panel de admin de Minuto90, donde manualmente o semi-automáticamente se asocien las ligas.
- Detectar torneos nuevos (futures, copas con nombre cambiado, etc.).

### Estrategia de cache
- **TTL medio** (1–6 horas). Pueden aparecer/desaparecer torneos.
- Tabla `kickertech_tournaments(id, sport_id, country_id, name, mapped_league_id_apifootball, last_seen_at)`.

---

## Endpoint 4 — Get Events List

### URL
```
GET https://affiliates.websbkt.com/{sportId}/{countryId}/{tournamentId}/events
```

### Parámetros (path)
| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `sportId` | `int` | ✅ | |
| `countryId` | `int` | ✅ | |
| `tournamentId` | `int` | ✅ | |

### Respuesta
Array de objetos `Event`.

**Schema:**
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID del evento (clave para llamar al feed individual). |
| `home` | `string` | Nombre del equipo local. En outrights, contiene la pregunta o título (ej: "Winner"). |
| `away` | `string` | Nombre del equipo visitante. **Vacío en outrights.** |
| `date_start` | `string (ISO 8601 UTC)` | Fecha y hora del comienzo. |

### Ejemplo de respuesta
```json
[
  {
    "id": 11534450,
    "home": "Philadelphia Eagles",
    "away": "Washington Commanders",
    "date_start": "2025-01-26T20:00:00.000Z"
  },
  {
    "id": 11538147,
    "home": "Kansas City Chiefs",
    "away": "Buffalo Bills",
    "date_start": "2025-01-26T23:30:00.000Z"
  }
]
```

### Casos de uso
- **Ésta es la lista contra la que se hace el matching con los fixtures de api-football.** Comparando `home` + `away` + `date_start` se puede asociar `kickertech_event_id` ↔ `apifootball_fixture_id`.
- Saber qué partidos *tienen mercados activos* en Kickertech antes de pedir el feed XML pesado.
- Construir endpoints internos del tipo "¿este partido tiene cuotas disponibles?".

### Estrategia de cache
- **TTL bajo** (5–15 minutos en prematch, 1–2 minutos cuando se acerca el inicio).
- En live, los eventos pueden aparecer/desaparecer rápido — refrescar agresivo.
- Esta lista es **liviana** (solo IDs y nombres), así que se puede pollear sin riesgo de costo.

---

## Notas transversales para el agente

### Códigos de error esperados
El PDF no documenta códigos de error. Asumir lo estándar:
- `200 OK` → respuesta válida
- `403 Forbidden` → IP no whitelisteada (causa más probable de fallo en producción nueva)
- `404 Not Found` → sportId/countryId/tournamentId inexistente
- `429 Too Many Requests` → no documentado pero probable. Implementar backoff exponencial.
- `5xx` → error del lado de Kickertech. Reintentar con backoff.

> Implementar logging detallado en cada llamada para detectar 403 (IP) y mensajes inesperados (cambios de schema).

### Formato de fecha
Todas las fechas son **ISO 8601 con sufijo `Z`** (UTC). Convertir a la timezone local del usuario en el frontend, no en el backend.

### Encoding de nombres
Pueden venir caracteres acentuados, ñ, símbolos asiáticos. Asegurar UTF-8 en todo el pipeline (DB, parser, frontend).

### Nombres de equipos — importante para el matching
**No coinciden exactamente con los de api-football.** Ejemplos comunes:
- Kickertech: "Real Madrid" — api-football: "Real Madrid"
- Kickertech: "Manchester Utd" — api-football: "Manchester United"
- Kickertech: "Bayern Munich" — api-football: "Bayern München"
- Kickertech: "Atletico Madrid" — api-football: "Atlético Madrid"

Esto **obliga a tener un layer de normalización** (ver Parte 4).

---

## Continuación

- **Parte 3**: el feed XML — la estructura anidada `Sbx → Sports → Sport → Country → Tournament → Event → Market → Odd`, los atributos exactos de cada nodo, y el catálogo `Markets` paralelo.
- **Parte 4**: integración, mapeo y roadmap.
