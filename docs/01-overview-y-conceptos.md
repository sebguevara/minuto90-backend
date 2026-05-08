# Kickertech API — Parte 1: Overview, Conceptos y Configuración

> **Objetivo del documento**: dar al agente de desarrollo el contexto conceptual de la API de Kickertech antes de tocar código. Aquí se explica **qué es**, **qué provee**, **cómo se autentica**, y cómo se relaciona con la API actual de Minuto90 (api-football).

---

## 1. Contexto del proyecto

Minuto90 actualmente consume **api-football** para obtener:
- Fixtures (partidos programados, en vivo, finalizados)
- Ligas y temporadas
- Equipos y plantillas
- Estadísticas y resultados en vivo

**Kickertech NO reemplaza a api-football.** La complementa.

| Capacidad | api-football | Kickertech |
|---|---|---|
| Fixtures / calendario | ✅ Fuente principal | ⚠️ Sólo eventos con cuotas activas |
| Resultados / livescore | ✅ Fuente principal | ❌ No es su foco |
| Estadísticas (posesión, tiros, etc.) | ✅ | ❌ |
| Plantillas y jugadores | ✅ | ❌ |
| **Cuotas (odds) prematch** | ❌ | ✅ Fuente principal |
| **Cuotas live** | ❌ | ✅ Fuente principal |
| **Mercados de apuesta (handicap, over/under, etc.)** | Limitado | ✅ Catálogo completo |
| **Betslip / link de afiliado** | ❌ | ✅ |

**Conclusión arquitectónica**: api-football es la fuente de verdad para *qué partidos existen*, Kickertech es la fuente de verdad para *qué cuotas y mercados están disponibles para apostar*. La integración requiere una **capa de mapeo (matching)** entre ambos sistemas porque sus IDs son distintos.

---

## 2. Las dos APIs de Kickertech (importante)

Los PDFs entregados muestran **dos versiones**:

### 2.1 Affiliate Feed API (legacy / "OLD")
- Namespace XML: `tglab`
- Marcada explícitamente como **OLD** en el documento
- Endpoint del feed: `https://{TGLabHost}/affiliates/feeds/configs/{configId}/{configHash}`
- **No usar para nuevas integraciones.** Sólo referencia histórica.

### 2.2 Sportsbook Feed API (actual — versión 13, enero 2025)
- Namespace XML: `Sbx`
- Endpoint del feed: `https://{SbxHost}/affiliates/feeds/configs/{configId}/{configHash}?sport={sportId}`
- Soporta además consulta por **evento individual** (`&eid={EventId}`)
- Agrega un endpoint nuevo: **Get Events List**
- **Esta es la API que vamos a integrar.**

> **Regla para el agente**: ignorar todo lo del namespace `tglab` y la sección "OLD". Implementar contra el namespace `Sbx`.

---

## 3. Terminología (glosario)

| Término | Definición |
|---|---|
| **KTBO** | Kickertech Backend Office. Backend que gestiona odds, stakes y resultados. No lo consumimos directamente. |
| **KTHost / SbxHost** | Host privado que Kickertech asigna al operador para el feed. Lo entregan junto con las credenciales. |
| **configId** | ID de configuración del feed. Lo entrega Kickertech. Va en la URL del feed. |
| **configHash** | Hash secreto que actúa como "API key" del feed. Va en la URL del feed. |
| **Operator** | Nosotros (Minuto90). El que consume el feed. |
| **Sport** | Deporte (Fútbol, Baloncesto, Tenis, etc.). Tiene un `id` numérico. |
| **Country** | País o región contenedora de torneos (Europa, World, Argentina, etc.). |
| **Tournament** | Liga, copa o competición (Premier League, MLB, Roland Garros). |
| **Event** | Partido individual (o "outright" — apuesta a ganador del torneo). |
| **Market** | Tipo de apuesta dentro de un evento (1X2, Handicap, Over/Under). Tiene `type_id`. |
| **Odd** | Selección concreta dentro de un mercado, con su cuota. Tiene `id`, `decimal`, `price`, `value`. |
| **Outright** | Evento sin equipo "away". Es una apuesta a ganador de torneo (ej: "Quién gana la Champions"). |
| **Betslip** | URL de afiliado para abrir directamente la apuesta en el sportsbook de Kickertech. |
| **Linked event** | Evento relacionado (ej: el mismo partido en versión live vs prematch). |

---

## 4. Configuración inicial — Pre-requisitos

Antes de escribir una línea de integración, hay que coordinar con Kickertech lo siguiente:

### 4.1 Whitelisting de IPs
Kickertech bloquea por IP. Hay que entregarles:
- IP fija del backend de Minuto90 (producción)
- IP del entorno de staging
- IP del entorno de desarrollo (si va a llamar a la API)

> ⚠️ Si Minuto90 está hosteado en un proveedor con IPs dinámicas (Vercel, serverless lambdas), **no se va a poder llamar a Kickertech directamente desde el frontend o desde funciones serverless con IP variable**. Hay que tener un **backend con IP estática** (VPS, EC2 con Elastic IP, Cloudflare Tunnel con egress fijo, etc.) actuando como proxy/cache.

### 4.2 Credenciales que entrega Kickertech
1. **`SbxHost`** — un dominio único por operador (ej: `feed-minuto90.websbkt.com`)
2. **`configId`** — entero o string corto
3. **`configHash`** — hash largo, secreto

### 4.3 Variables de entorno recomendadas
```
KICKERTECH_DISCOVERY_BASE_URL=https://affiliates.websbkt.com
KICKERTECH_FEED_HOST=https://<SbxHost-asignado>
KICKERTECH_CONFIG_ID=<configId>
KICKERTECH_CONFIG_HASH=<configHash>
```

> El `configHash` es **secreto**. Nunca exponerlo al frontend, nunca commitearlo.

---

## 5. Dos hosts distintos — distinguir bien

Kickertech opera con **dos URLs base diferentes** y es fácil confundirlas:

| Tipo de endpoint | Host | Autenticación | Formato respuesta |
|---|---|---|---|
| **Discovery** (sports, countries, tournaments, events) | `https://affiliates.websbkt.com` | Sólo IP whitelist | **JSON** |
| **Feed** (cuotas y mercados completos) | `https://{SbxHost}` (asignado por Kickertech) | IP whitelist + `configId` + `configHash` en URL | **XML** |

> **Regla mental**: si la URL incluye `configId/configHash`, devuelve XML. Si no, devuelve JSON.

---

## 6. Flujo conceptual de uso

El proceso recomendado por Kickertech (y la lógica natural) es:

```
1. GET /sports                                  → Catálogo de deportes
2. GET /{sportId}/countries                     → Países dentro del deporte
3. GET /{sportId}/{countryId}/tournaments       → Ligas dentro del país
4. GET /{sportId}/{countryId}/{tournamentId}/events  → Partidos dentro de la liga
5. GET /feeds/configs/{configId}/{configHash}?sport={sportId}              → Feed completo del deporte (todas las cuotas)
6. GET /feeds/configs/{configId}/{configHash}?sport={sportId}&eid={eventId}  → Feed de un evento puntual
```

**No todos los pasos se ejecutan siempre.** En producción habrá dos modos:

### 6.1 Modo "build catalog" (poco frecuente, una o dos veces por día)
Pasos 1 → 4. Sirve para construir la **tabla de mapeo** entre Kickertech y api-football. Resultados se cachean fuerte.

### 6.2 Modo "fetch odds" (frecuente, cada 30s–5min según live/prematch)
Pasos 5 o 6. Sirve para obtener cuotas actualizadas. Resultados se cachean corto, especialmente en live.

---

## 7. Datos que vamos a obtener (resumen de alto nivel)

De Kickertech, por cada evento, obtendremos:

- **Identificación del evento**: `id`, `home`, `away`, `start_date`, `is_live`
- **Mercados disponibles**: lista de tipos (1X2, Handicap asiático, Over/Under, Ambos marcan, etc.) — cada uno con su `type_id`
- **Cuotas (odds)** dentro de cada mercado: nombre, valor decimal (1.85), valor fraccional ("17/20"), parámetro (handicap/total — ej: 2.5)
- **Catálogo de mercados** al final del XML, que mapea cada `type_id` a un nombre legible
- **Betslip URL**: link de afiliado con placeholder `#ODD_ID` que reemplazamos por el ID del odd que el usuario haya seleccionado

**Lo que NO obtenemos de Kickertech:**
- Estadísticas del partido en vivo
- Alineaciones
- Comentarios o eventos del partido (goles, tarjetas, sustituciones)
- Tabla de posiciones
- H2H (head to head)

Esto sigue siendo responsabilidad de api-football.

---

## 8. Continuación

- **Parte 2**: detalle endpoint por endpoint de los **endpoints de descubrimiento (JSON)**
- **Parte 3**: detalle del **feed (XML)**, sus estructuras anidadas y todos los tipos
- **Parte 4**: estrategia de integración con api-football, mapeo de IDs, caching, roadmap de implementación
