# Kickertech API — Parte 4: Integración con api-football y Roadmap

> **Alcance**: cómo unir Kickertech con el sistema actual de Minuto90 (basado en api-football). Mapeo de IDs, normalización, capa de caching, arquitectura sugerida, y plan de implementación por fases.

---

## 1. El problema central: dos sistemas, dos catálogos de IDs

Minuto90 ya tiene su modelo basado en api-football:
- `league_id` (api-football) → "Liga Argentina", "Premier League", etc.
- `team_id` (api-football) → "River Plate", "Manchester City"
- `fixture_id` (api-football) → cada partido individual

Kickertech tiene los suyos:
- `tournament_id` → mismo concepto que `league_id` pero números completamente distintos
- `home`/`away` (strings, no IDs) → para identificar equipos
- `event_id` → mismo concepto que `fixture_id` pero numeración propia

**No existe identificador común.** Toda la integración se reduce a resolver:

> *"¿qué `event_id` de Kickertech corresponde al `fixture_id` X de api-football?"*

Esa función es el corazón del backend que hay que construir.

---

## 2. Estrategia de mapeo (de torneos y eventos)

### 2.1 Mapeo de torneos (manual + asistido)

**Recomendación**: mapeo **manual con asistencia automática**, no totalmente automático. Las ligas son pocas (cientos) y cambian poco. Equivocarse al asociar Premier League con La Liga sería catastrófico.

Flujo sugerido:
1. Backend levanta `kickertech_tournaments` (lista plana de torneos de Kickertech).
2. Backend levanta `apifootball_leagues` (lista de ligas que ya manejamos).
3. Para cada torneo de Kickertech sin mapeo:
   - Buscar matches por similitud de nombre (Levenshtein, fuzzy match) + país.
   - Sugerir top 3 candidatos de api-football.
4. Un humano (o el agente, en una primera pasada) confirma desde un panel admin.
5. Se persiste la asociación: `kickertech_tournament.mapped_apifootball_league_id`.

**Persistencia**: una vez confirmado, el mapeo es semi-permanente. Sólo se revisa cuando aparece un torneo nuevo no mapeado.

### 2.2 Mapeo de eventos (automático)

A diferencia de los torneos, los eventos son miles y cambian todos los días. Tiene que ser automático.

**Algoritmo sugerido** (en orden de aplicación):

1. **Filtro por torneo mapeado**: sólo intentar matchear eventos cuyos torneos ya estén asociados.
2. **Match por ventana temporal**: `kickertech_event.date_start` debe estar dentro de ±15 minutos del `apifootball_fixture.date`.
3. **Match por equipos normalizados**:
   - Normalizar ambos nombres (lowercase, sin acentos, sin sufijos como "FC", "CF", "AC").
   - Aplicar tabla de aliases conocidos ("Manchester Utd" → "Manchester United", "PSG" → "Paris Saint Germain").
   - Comparar con tolerancia de fuzzy match (Levenshtein < 3 caracteres o ratio > 0.85).
4. **Resultado**: si los dos equipos matchean Y la fecha cuadra, asociar `kickertech_event_id` ↔ `apifootball_fixture_id`. Persistir.
5. Si no hay match, registrar el evento en una tabla `kickertech_unmapped_events` para revisión.

> **El paso 3 es el más delicado.** Dedicar tiempo a construir y mantener una tabla de aliases. Cada vez que aparezca un partido sin match, agregarle a la tabla la regla que lo hubiera resuelto.

### 2.3 Tabla de aliases (sugerida)

```
team_aliases
  kickertech_name (string, indexada)
  apifootball_team_id (FK)
  confidence (float)
  verified_by (string, opcional)
  created_at
```

Empezar con un seed manual de los 200 clubes más populares (top 5 ligas europeas + sudamericana + selecciones). El resto se va llenando con el tiempo.

---

## 3. Normalización de datos

### 3.1 Conversión XML → JSON canónico

Una vez parseado el XML, **no se trabaja con el árbol XML en el resto del sistema**. Se aplana a un modelo canónico interno. Esto desacopla el resto del backend del formato de Kickertech (si mañana cambian a JSON o REST puro, sólo se reescribe la capa de adaptación).

Estructura canónica por evento:

```
{
  source: "kickertech",
  externalEventId: 3945939,
  sportId: 1,
  tournamentId: 4723,
  countryId: 17,
  startDate: "2021-09-30T17:00:00.000Z",
  isLive: false,
  linkedEventId: null,
  home: "Monaco",
  away: "Panathinaikos",
  betslipTemplate: "https://affiliate-tglab/event/...?betslip=#ODD_ID",
  markets: [
    {
      typeId: 10001,
      typeName: "OVERTIME",       // resuelto contra el catálogo
      odds: [
        { id: 1469867745, name: "Monaco", decimal: 1.8, fractional: "4/5", value: 0 },
        ...
      ]
    },
    ...
  ],
  fetchedAt: <timestamp>,
  mappedFixtureId: 12345678  // null si no se pudo matchear
}
```

### 3.2 Normalización de nombres (resumen práctico)

Función de normalización aplicada **siempre** antes de comparar nombres:
1. Trim
2. Lowercase
3. Remove diacritics (NFD + filter)
4. Remove sufijos comunes: ` fc`, ` cf`, ` sc`, ` ac`, ` afc`, ` cd`
5. Replace `-` y `.` por espacio
6. Collapse de espacios múltiples

> No persistir el nombre normalizado. Es función pura, recalcular cuando se necesite.

### 3.3 Decimal vs fractional vs valor americano

- Kickertech entrega `decimal` y `price` (fraccional). **No entrega formato americano.**
- En frontend dejamos al usuario elegir formato (preferencia ya común en sportsbooks).
- Si necesitamos formato americano, lo derivamos del decimal:
  - decimal ≥ 2.0 → `+(decimal - 1) × 100` redondeado
  - decimal < 2.0 → `-100 / (decimal - 1)` redondeado

---

## 4. Arquitectura recomendada

### 4.1 Diagrama lógico

```
┌──────────────────┐
│  api-football    │ ── fixtures, ligas, livescore ──┐
└──────────────────┘                                  ▼
                                          ┌─────────────────────┐
┌──────────────────┐                      │                     │
│   Kickertech     │                      │  Backend Minuto90   │
│  (IP whitelist)  │ ── XML/JSON feed ──> │  (IP estática)      │
└──────────────────┘                      │                     │
                                          │  ┌──────────────┐   │
                                          │  │ Adapter Layer│   │
                                          │  │  Kickertech  │   │
                                          │  └──────────────┘   │
                                          │  ┌──────────────┐   │
                                          │  │  Mapping     │   │
                                          │  │  Service     │   │
                                          │  └──────────────┘   │
                                          │  ┌──────────────┐   │
                                          │  │  Cache       │   │
                                          │  │ (Redis/DB)   │   │
                                          │  └──────────────┘   │
                                          └─────────┬───────────┘
                                                    │
                                                    ▼ JSON unificado
                                          ┌─────────────────────┐
                                          │   Frontend          │
                                          │   minuto90score.com │
                                          └─────────────────────┘
```

**Reglas duras**:
- El frontend **nunca** llama a Kickertech directamente.
- El frontend **nunca** ve el XML.
- El frontend consume sólo nuestro JSON unificado.
- El `configHash` jamás sale del backend.

### 4.2 Componentes del backend

1. **KickertechClient** — capa HTTP que llama a Kickertech. Maneja IP, retries, backoff, logs.
2. **KickertechXmlParser** — convierte XML → estructura interna.
3. **KickertechAdapter** — toma la estructura interna y la transforma al modelo canónico.
4. **MappingService** — resuelve `kickertechEventId ↔ apifootballFixtureId` usando la tabla de aliases.
5. **OddsCache** — Redis con TTLs por estado del evento (live vs prematch).
6. **OddsRepository** — lectura/escritura en DB para auditoría histórica (opcional pero recomendado).
7. **Scheduler** — cron/queue que dispara los refreshes (sport feed, event feed para los partidos en vivo).

### 4.3 Política de caching (resumen)

| Recurso | TTL prematch | TTL live | Almacenamiento |
|---|---|---|---|
| `/sports` | 24h | — | DB + Redis |
| `/{sport}/countries` | 12h | — | DB + Redis |
| `/{sport}/{country}/tournaments` | 6h | — | DB + Redis |
| `/{sport}/{country}/{tournament}/events` | 10 min | 1 min | Redis |
| Sport feed XML (parseado) | 3 min | 30 s | Redis |
| Event feed XML (parseado) | 30 s | 10 s | Redis |
| Mapeos torneo↔liga | permanente | permanente | DB |
| Mapeos evento↔fixture | hasta `start_date + 4h` | — | DB |

### 4.4 Política de refresh

- **Cron pesado** (cada N minutos): tira el sport feed completo de los deportes "calientes" (fútbol, basket).
- **On-demand** (cuando el front pide un partido): si el cache del event feed está vencido, se refresca **sólo ese evento** desde Kickertech antes de responder.
- **Live workers**: para los partidos `is_live=1`, un worker dedicado los refresca cada 10–30s sin esperar al usuario.

---

## 5. Endpoints internos sugeridos para el frontend

El backend de Minuto90 debería exponer (a su propio frontend) algo como:

| Endpoint interno | Devuelve |
|---|---|
| `GET /api/fixture/{apifootballFixtureId}/odds` | Cuotas (todos los mercados) del partido, ya mapeadas. |
| `GET /api/fixture/{apifootballFixtureId}/odds/main` | Sólo el mercado principal (1X2 o moneyline) — para listados. |
| `GET /api/fixture/{apifootballFixtureId}/betslip?oddId=X` | URL de redirect para el click del usuario en una cuota. |
| `GET /api/leagues/{leagueId}/fixtures-with-odds` | Listado de partidos de una liga con sus cuotas principales. |

> El front nunca debería ver nada que diga "kickertech" en su URL ni en su payload. El branding y la abstracción son nuestros.

---

## 6. Manejo de errores y casos borde

### 6.1 Eventos sin mapeo
Cuando un usuario abre un partido en Minuto90 que existe en api-football pero **no tiene match en Kickertech** (la mayoría de los partidos de ligas menores), el frontend debe degradar grácil: mostrar el partido normal sin la sección de cuotas, en vez de fallar.

### 6.2 Evento mapeado pero sin mercados activos
Puede pasar que un evento esté en Kickertech pero el feed lo devuelva sin children `<Market>`. Tratar como "no hay cuotas en este momento".

### 6.3 Cuotas obsoletas
Toda respuesta al frontend incluye `fetchedAt`. Si el front detecta que es muy viejo (> 60s en live), advertir visualmente o re-pedir.

### 6.4 Drift de naming
Kickertech puede cambiar "Manchester Utd" a "Man Utd" sin avisar. El monitoreo de eventos no mapeados (`kickertech_unmapped_events`) debería tener una métrica/alerta: si la tasa de no-mapeo sube súbitamente, hay drift.

### 6.5 Cambios de schema
Loggear cualquier campo nuevo o desconocido en el XML. Kickertech puede agregar atributos sin avisar.

---

## 7. Roadmap de implementación por fases

### Fase 0 — Pre-requisitos (1–2 días)
- [ ] Coordinar con Kickertech: enviar IPs para whitelist, recibir `SbxHost`, `configId`, `configHash`.
- [ ] Confirmar IP estática del backend de producción.
- [ ] Cargar credenciales en el secret manager / env del backend.
- [ ] Smoke test: `GET /sports` desde la IP autorizada → debe responder 200.

### Fase 1 — Cliente y discovery (3–5 días)
- [ ] Implementar `KickertechClient` con los 4 endpoints JSON.
- [ ] Persistir el catálogo: `kickertech_sport`, `kickertech_country`, `kickertech_tournament`, `kickertech_event`.
- [ ] Cron diario que refresque sports/countries/tournaments.
- [ ] Cron cada 10 min que refresque la lista de events de los torneos mapeados.
- [ ] Endpoint admin (interno) para ver el catálogo crudo.

### Fase 2 — Parsing del feed XML (3–4 días)
- [ ] Implementar el parser XML → modelo canónico.
- [ ] Implementar la resolución de `type_id` → `name` contra el bloque `<Markets>`.
- [ ] Tests unitarios con el ejemplo del PDF y con muestras reales.
- [ ] Persistir o cachear los `markets` y `odds`.

### Fase 3 — Mapeo de torneos (2–3 días)
- [ ] Implementar el matcher de torneos (Kickertech → api-football) por similitud + país.
- [ ] Construir un panel admin minimalista para confirmar mapeos.
- [ ] Hacer un primer mapeo masivo de las 50 ligas más importantes.

### Fase 4 — Mapeo de eventos (3–5 días)
- [ ] Implementar el matcher automático de eventos (ventana temporal + nombres normalizados + aliases).
- [ ] Seed inicial de la tabla de aliases con los 200 equipos top.
- [ ] Worker que corre cada X minutos y mapea los eventos no mapeados.
- [ ] Métrica de % de eventos mapeados por liga (visible en admin).

### Fase 5 — Servicio de cuotas para el frontend (3–4 días)
- [ ] Endpoint `GET /api/fixture/{id}/odds`.
- [ ] Endpoint `GET /api/fixture/{id}/betslip?oddId=`.
- [ ] Lógica de refresh on-demand desde Kickertech cuando el cache vence.
- [ ] Lógica de degradación cuando no hay match.

### Fase 6 — Live workers (3–4 días)
- [ ] Identificar eventos con `is_live=1` en cada refresh del feed.
- [ ] Worker dedicado que los refresca cada 15s.
- [ ] Cache especial con TTL más corto.
- [ ] Endpoint con polling/SSE/WebSocket si el frontend va a actualizar cuotas en vivo (opcional fase 7).

### Fase 7 — Mejoras y observabilidad (continuo)
- [ ] Métricas: tasa de mapeo, latencias, % de cache hit, tamaño promedio del XML, errores por endpoint.
- [ ] Alertas: drop súbito de tasa de mapeo, errores 4xx/5xx persistentes, cuotas viejas.
- [ ] Dashboard admin: estado de cada liga, último refresh, eventos sin mapear con sus candidatos sugeridos.
- [ ] Auditoría: histórico de cambios de cuotas (opcional, costoso en storage).

---

## 8. Checklist de decisiones que el agente debe tomar (con guía)

| Decisión | Recomendación |
|---|---|
| ¿XML parser? | `fast-xml-parser` (Node) — manejar atributos como props directas. |
| ¿Cache layer? | Redis. Si no hay, fallback DB con TTL en columna. |
| ¿Persistir histórico de odds? | No en MVP. Sólo `fetchedAt` actual. Considerar después para features tipo "evolución de cuota". |
| ¿Polling o WebSocket en frontend? | Polling cada 30s suficiente para MVP. WebSocket sólo si hay demanda de live de calidad sportsbook. |
| ¿Mapeo de eventos automático o asistido? | Automático con monitoreo. Ligas mayores: tasa de mapeo debería ser >95%. |
| ¿Mostrar cuotas si no hay mapeo? | No. Si no hay mapeo seguro, no mostrar cuotas (peor mostrar las equivocadas). |
| ¿Soportar multi-currency / multi-locale? | Kickertech entrega odds en formato neutro. La conversión y UI es nuestra. |

---

## 9. Riesgos identificados

1. **IP whitelist insuficiente en serverless**. Si Minuto90 corre en Vercel/Netlify, hay que poner un proxy backend con IP fija. Resolverlo en Fase 0.
2. **Volumen del XML**. El feed full de fútbol puede ser pesado. Considerar pedirlo por torneo específico si Kickertech lo permite, o filtrar post-parseo.
3. **Drift de nombres de equipos**. Inevitable. Mitigado con tabla de aliases + monitoreo.
4. **Dependencia de un único hash** (`configHash`). Si se filtra, comprometer toda la integración. Tratarlo como password — rotación coordinada con Kickertech.
5. **Outrights y eventos especiales** (apuestas a ganador de torneo). No tienen `away`. El frontend debe distinguirlos.
6. **Linked events duplicados**. Implementar deduplicación en la capa adapter usando `linked_event_id`.
7. **Cambios de schema sin previo aviso**. Kickertech publicó al menos 13 versiones de su doc — asumir que el formato puede mutar y blindar el parser con tolerancia a campos desconocidos.

---

## 10. Resumen ejecutivo (para mostrar al equipo)

> Kickertech aporta a Minuto90 lo que api-football no tiene: **cuotas y mercados de apuestas**, con un link de afiliado monetizable. La integración consiste en (1) descargar y cachear el catálogo de Kickertech, (2) construir una tabla de mapeo entre sus IDs y los de api-football, (3) parsear su feed XML a un modelo interno limpio, y (4) exponer endpoints internos al frontend que combinen ambas fuentes. El esfuerzo total estimado para un MVP funcional es de **3–4 semanas de un dev backend** (sin contar el panel admin pulido), priorizando primero los deportes y ligas más vistos.

---

## Anexo — Resumen de los 6 endpoints (cheat sheet)

| # | Método | URL | Auth | Formato | Para qué |
|---|---|---|---|---|---|
| 1 | GET | `https://affiliates.websbkt.com/sports` | IP | JSON | Catálogo de deportes |
| 2 | GET | `https://affiliates.websbkt.com/{sportId}/countries` | IP | JSON | Países por deporte |
| 3 | GET | `https://affiliates.websbkt.com/{sportId}/{countryId}/tournaments` | IP | JSON | Ligas por país (multi: `1,2,3`) |
| 4 | GET | `https://affiliates.websbkt.com/{sportId}/{countryId}/{tournamentId}/events` | IP | JSON | Partidos por liga |
| 5 | GET | `https://{SbxHost}/affiliates/feeds/configs/{configId}/{configHash}?sport={sportId}` | IP + secret | XML | Feed completo de un deporte (todas las cuotas) |
| 6 | GET | `https://{SbxHost}/affiliates/feeds/configs/{configId}/{configHash}?sport={sportId}&eid={eventId}` | IP + secret | XML | Feed de un único evento |

**Fin de la documentación.**
