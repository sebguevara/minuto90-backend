# Minuto 90 — Notificaciones WhatsApp en Tiempo Real (Polling + Estado)

Este documento describe el sistema de notificaciones “minuto a minuto” basado en:

- Polling cada ~5s a API-Football (`/fixtures?live=all`)
- Estado previo por `fixtureId` en Redis (TTL 4 horas)
- “Diff Engine” que detecta deltas (goles, rojas, cambios de estado)
- Encolado en BullMQ (rate limiting)
- Envío por Evolution API (WhatsApp)

## Flujo (alto nivel)

1. `live-fixtures-poller` consulta live fixtures.
2. Por cada fixture:
   - Lee `match_state:{fixtureId}` desde Redis.
   - Calcula triggers comparando estado viejo vs estado nuevo (Diff Engine).
   - Si hay triggers, busca suscriptores en Postgres (Prisma) por `fixtureId`.
   - Encola un job por (fixtureId + trigger + subscriber) en BullMQ.
   - Si hubo cambios relevantes, persiste el nuevo estado en Redis (TTL 4h).
3. `whatsapp-notifications.worker` consume la cola con limiter estricto (5 msg/seg) y envía a Evolution API.

## Componentes en el repo

- Prisma (Minuto DB):
  - `NotificationSubscriber`: suscriptor (teléfono, activo)
  - `MatchSubscription`: suscripción (fixtureId + metadata del partido)
  - `EvolutionInstance`: config del ejecutor Evolution (instanceName/baseUrl/apiKey)
  - Archivo: `prisma-minuto/schema.prisma`

- Diff Engine + Templates:
  - Templates WhatsApp: `src/features/notifications/application/templates.ts`
  - Diff Engine: `src/features/notifications/application/diff-engine.ts`
  - Tests: `src/features/notifications/application/diff-engine.test.ts`

- Infra:
  - Redis connection: `src/shared/redis/redis.connection.ts`
  - API-Football live client: `src/features/notifications/infrastructure/api-football-live.client.ts`
  - Evolution API client: `src/features/notifications/infrastructure/evolution-api.client.ts`

- Colas / Workers:
  - Queue + dedupe por `jobId`: `src/features/notifications/whatsapp/notification.queue.ts`
  - Worker BullMQ (rate limit): `src/workers/whatsapp-notifications.worker.ts`
  - Poller principal: `src/workers/live-fixtures-poller.ts`

## Triggers implementados (Diff Engine)

Reglas principales (estado viejo vs nuevo):

- `KICKOFF`: `old in ['NS', null]` y `new == '1H'`
- `GOAL`: sube `goals.home` o `goals.away` (toma último evento `type="Goal"`)
- `VAR_CANCELLED`: baja `goals.home` o `goals.away`
- `RED_CARD`: aumenta el conteo de eventos `type="Card" & detail="Red Card"`
- `HALFTIME`: `new == 'HT'` y `old != 'HT'`
- `SECOND_HALF`: `new == '2H'` y `old == 'HT'`
- `FULL_TIME`: `new in ['FT','AET','PEN']` y `old not in ['FT','AET','PEN']`

Importante: la deduplicación de envíos se hace por `jobId` en BullMQ:
`{fixtureId}:{triggerType}:{subscriberId}:{eventKey}`.

## Mensajes (WhatsApp)

Los templates exactos provistos están implementados para:

- GOAL ⚽
- RED_CARD 🟥
- VAR_CANCELLED ❌
- KICKOFF 🕐
- FULL_TIME 🏁

Además hay templates internos para `HALFTIME` y `SECOND_HALF` (si querés que sean *exactos* también, definimos el copy final y se ajusta).

## Variables de entorno

### Redis
- `REDIS_URL` (default: `redis://localhost:6379/0`)

### API-Football
- `FOOTBALL_API_KEY` (recomendado)
- Alternativa compatible: `API_KEY`
- `FOOTBALL_API_URL` (default: `https://v3.football.api-sports.io`)

### Evolution API
Opciones:

1) Por variables de entorno (override, sin DB):
- `EVOLUTION_INSTANCE_NAME`
- `EVOLUTION_API_KEY`
- `EVOLUTION_API_URL` (default: `http://localhost:9090`)
- `EVOLUTION_USE_JID` (`true` para enviar como `54911...@s.whatsapp.net`, default `false`)

2) Por DB:
- Crear un row en `EvolutionInstance` con `isActive=true` (se usa el más nuevo por `createdAt desc`).

### Poller
- `LIVE_POLL_INTERVAL_MS` (default: `5000`): tiempo entre polls al endpoint live; menor = notificaciones más reactivas (más llamadas a la API).
- `LIVE_FULL_TIME_MISSING_POLLS` (default: `3`): encuestas seguidas en las que el partido ya no aparece en la lista live antes de enviar el fallback de “final” (evita esperas largas si el proveedor quita el fixture antes de exponer `FT`).
- `LIVE_POLL_CONCURRENCY` (default: `10`)
- `NOTIFICATIONS_DEBUG` (`true` para logs de jobs completados)

## Cómo ejecutar (local/dev)

1) Instalar deps:
```bash
bun install
```

2) Migraciones Prisma (minuto):
```bash
bunx prisma migrate dev --schema ./prisma-minuto/schema.prisma
bunx prisma generate --schema ./prisma-minuto/schema.prisma
```

3) Levantar infraestructura (docker):
```bash
docker compose up -d redis
```

4) Correr workers (en 2 terminals):
```bash
bun run worker:whatsapp
```
```bash
bun run worker:poll-live
```

## Cómo crear suscripciones (estado actual)

Por ahora el sistema asume que existen filas en DB:

- `NotificationSubscriber` (teléfono en formato internacional, solo dígitos recomendado)
- `MatchSubscription` (con `fixtureId`)

Siguiente paso recomendado: endpoints/admin para alta/baja y gestión de suscripciones.

## Next steps (recomendados)

1) API de suscripciones (Elysia):
   - CRUD `NotificationSubscriber`
   - CRUD `MatchSubscription` por `fixtureId`
   - Endpoint “subscribe by fixtureId” + validación

2) Admin de ejecutor Evolution:
   - Endpoint para crear/rotar `EvolutionInstance`
   - Soporte multi-instancia (round-robin o por shard) si crece el volumen

3) Dedupe más robusto:
   - Actualmente la dedupe es por score/status/redCount (y `jobId`).
   - Si querés evitar *cualquier* duplicado ante reinicios o reorden de eventos, agregar “event ledger” en Redis/DB (set de `eventKey` por fixture con TTL).

4) Manejo de múltiples eventos en un mismo poll:
   - Si el score salta de 0→2 entre polls, hoy se envía 1 notificación de GOAL (por delta de score).
   - Mejorar para enviar 2 mensajes si aparecen 2 eventos distintos (según `events[]`).

5) Observabilidad:
   - Métricas: jobs en cola, latencia, tasa de errores por Evolution/API-Football
   - Logs estructurados con fixtureId/subscriberId/triggerType

6) Templates finales:
   - Definir copy final para `HALFTIME` y `SECOND_HALF` si van a WhatsApp.

## Troubleshooting

- “Missing API-Football key”: setear `FOOTBALL_API_KEY` (o `API_KEY`).
- “No active EvolutionInstance found”: setear `EVOLUTION_INSTANCE_NAME` + `EVOLUTION_API_KEY` o crear un `EvolutionInstance` activo en DB.
- Redis: confirmar `REDIS_URL` (en Docker: `redis://redis:6379/0`).

