# Endpoints de Football (Partidos y Temporadas)

Documentación completa de los endpoints para obtener información de partidos, temporadas y equipos desde la API de api-sports.io.

## Base URL
```
http://localhost:4500/football
```

## 🔑 Nota Importante sobre Temporadas

**PROBLEMA RESUELTO:** Estos endpoints obtienen automáticamente la temporada actual de cada liga desde la API, por lo que ya NO necesitas hardcodear el año 2026 u otro año incorrecto.

La API de api-sports.io devuelve un array de `seasons` para cada liga, donde cada season tiene una propiedad `current: true` que indica cuál es la temporada activa. Estos endpoints usan esa temporada automáticamente.

---

## 📅 Endpoints de Temporadas

### 1. Obtener todas las temporadas de una liga

**Endpoint:** `GET /football/leagues/:leagueId/seasons`

**Descripción:** Obtiene todas las temporadas históricas de una liga, incluyendo cuál es la temporada actual.

**Parámetros de ruta:**
- `leagueId` (requerido): ID de la liga en api-sports.io

**Ejemplo:**
```bash
GET /football/leagues/135/seasons
```

**Respuesta:**
```json
{
  "data": {
    "league": {
      "id": 135,
      "name": "Serie A",
      "type": "League",
      "logo": "https://media.api-sports.io/football/leagues/135.png"
    },
    "country": {
      "name": "Italy",
      "code": "IT",
      "flag": "https://media.api-sports.io/flags/it.svg"
    },
    "seasons": [
      {
        "year": 2023,
        "start": "2023-08-19",
        "end": "2024-05-26",
        "current": false,
        "coverage": { ... }
      },
      {
        "year": 2024,
        "start": "2024-08-17",
        "end": "2025-05-25",
        "current": false,
        "coverage": { ... }
      },
      {
        "year": 2025,
        "start": "2025-08-23",
        "end": "2026-05-24",
        "current": true,  // <- Esta es la temporada ACTUAL
        "coverage": { ... }
      }
    ],
    "currentSeason": {
      "year": 2025,
      "start": "2025-08-23",
      "end": "2026-05-24",
      "current": true,
      "coverage": {
        "fixtures": {
          "events": true,
          "lineups": true,
          "statistics_fixtures": true,
          "statistics_players": true
        },
        "standings": true,
        "players": true,
        "top_scorers": true,
        "top_assists": true,
        "top_cards": true,
        "injuries": true,
        "predictions": true,
        "odds": true
      }
    }
  }
}
```

---

### 2. Obtener solo la temporada actual de una liga

**Endpoint:** `GET /football/leagues/:leagueId/current-season`

**Descripción:** Obtiene únicamente la temporada actual (current: true) de una liga.

**Ejemplo:**
```bash
GET /football/leagues/135/current-season
```

**Respuesta:**
```json
{
  "data": {
    "year": 2025,
    "start": "2025-08-23",
    "end": "2026-05-24",
    "current": true,
    "coverage": {
      "fixtures": {
        "events": true,
        "lineups": true,
        "statistics_fixtures": true,
        "statistics_players": true
      },
      "standings": true,
      "players": true,
      "top_scorers": true,
      "top_assists": true,
      "top_cards": true,
      "injuries": true,
      "predictions": true,
      "odds": true
    }
  }
}
```

**Uso recomendado:** Usa este endpoint cuando solo necesites saber qué temporada está activa, sin necesitar todo el historial.

---

## ⚽ Endpoints de Partidos (Fixtures)

### 3. Obtener los últimos N partidos de un equipo

**Endpoint:** `GET /football/teams/:teamId/last-matches`

**Descripción:** Obtiene los últimos N partidos **finalizados** de un equipo en la **temporada actual** de una liga específica.

**⚠️ IMPORTANTE:**
- Este endpoint obtiene automáticamente la temporada actual
- Solo retorna partidos finalizados (status: FT, AET, PEN, AWD, WO)
- Los partidos se ordenan por fecha descendente (más recientes primero)

**Parámetros de ruta:**
- `teamId` (requerido): ID del equipo en api-sports.io

**Query parameters:**
- `leagueId` (requerido): ID de la liga
- `limit` (opcional, default: 5): Cantidad de partidos a retornar

**Ejemplo:**
```bash
GET /football/teams/489/last-matches?leagueId=135&limit=5
```

**Respuesta:**
```json
{
  "data": [
    {
      "fixture": {
        "id": 1234567,
        "date": "2025-02-01T19:45:00+00:00",
        "timestamp": 1738437900,
        "status": {
          "long": "Match Finished",
          "short": "FT",
          "elapsed": 90
        },
        "venue": {
          "name": "San Siro",
          "city": "Milano"
        }
      },
      "league": {
        "id": 135,
        "name": "Serie A",
        "country": "Italy",
        "season": 2025,
        "round": "Regular Season - 23"
      },
      "teams": {
        "home": {
          "id": 489,
          "name": "AC Milan",
          "logo": "https://...",
          "winner": true
        },
        "away": {
          "id": 487,
          "name": "Lazio",
          "logo": "https://...",
          "winner": false
        }
      },
      "goals": {
        "home": 2,
        "away": 1
      },
      "score": {
        "halftime": { "home": 1, "away": 0 },
        "fulltime": { "home": 2, "away": 1 },
        "extratime": { "home": null, "away": null },
        "penalty": { "home": null, "away": null }
      }
    }
    // ... más partidos
  ],
  "meta": {
    "count": 5,
    "limit": 5
  }
}
```

---

### 4. Obtener los próximos N partidos de un equipo

**Endpoint:** `GET /football/teams/:teamId/next-matches`

**Descripción:** Obtiene los próximos N partidos programados de un equipo en la temporada actual.

**Parámetros:** Idénticos al endpoint de últimos partidos.

**Ejemplo:**
```bash
GET /football/teams/489/next-matches?leagueId=135&limit=5
```

---

### 5. Obtener todos los partidos de un equipo en la temporada actual

**Endpoint:** `GET /football/teams/:teamId/fixtures`

**Descripción:** Obtiene TODOS los partidos (pasados, presentes y futuros) de un equipo en la temporada actual de una liga.

**Query parameters:**
- `leagueId` (requerido): ID de la liga
- `status` (opcional): Filtrar por status del partido
  - `FT` - Finalizado (Finished)
  - `NS` - No empezado (Not Started)
  - `LIVE` - En vivo
  - `PST` - Pospuesto
  - `CANC` - Cancelado
  - etc.

**Ejemplo:**
```bash
# Todos los partidos
GET /football/teams/489/fixtures?leagueId=135

# Solo partidos finalizados
GET /football/teams/489/fixtures?leagueId=135&status=FT

# Solo partidos por jugar
GET /football/teams/489/fixtures?leagueId=135&status=NS
```

**Respuesta:**
```json
{
  "data": {
    "season": {
      "year": 2025,
      "start": "2025-08-23",
      "end": "2026-05-24",
      "current": true
    },
    "fixtures": [
      // ... todos los partidos del equipo en esta temporada
    ]
  },
  "meta": {
    "count": 38,
    "season": 2025
  }
}
```

---

### 6. Obtener un partido específico por ID

**Endpoint:** `GET /football/fixtures/:fixtureId`

**Descripción:** Obtiene información detallada de un partido específico.

**Ejemplo:**
```bash
GET /football/fixtures/1234567
```

---

## 📊 Endpoint de Estadísticas

### 7. Obtener estadísticas de un equipo en la temporada actual

**Endpoint:** `GET /football/teams/:teamId/statistics`

**Descripción:** Obtiene estadísticas completas de un equipo en la temporada actual de una liga (victorias, derrotas, goles, etc.).

**Query parameters:**
- `leagueId` (requerido): ID de la liga

**Ejemplo:**
```bash
GET /football/teams/489/statistics?leagueId=135
```

**Respuesta:**
```json
{
  "data": {
    "season": {
      "year": 2025,
      "start": "2025-08-23",
      "end": "2026-05-24",
      "current": true
    },
    "statistics": {
      "league": { ... },
      "team": { ... },
      "form": "WWDWL",
      "fixtures": {
        "played": { "home": 12, "away": 11, "total": 23 },
        "wins": { "home": 8, "away": 6, "total": 14 },
        "draws": { "home": 2, "away": 3, "total": 5 },
        "loses": { "home": 2, "away": 2, "total": 4 }
      },
      "goals": {
        "for": { "total": 45, "average": "1.96" },
        "against": { "total": 28, "average": "1.22" }
      },
      // ... más estadísticas
    }
  }
}
```

---

## 🎯 IDs Comunes de Ligas

Aquí hay algunos IDs de ligas populares para que los uses en tus requests:

| Liga | ID | País |
|------|-----|------|
| Premier League | 39 | Inglaterra |
| La Liga | 140 | España |
| Serie A | 135 | Italia |
| Bundesliga | 78 | Alemania |
| Ligue 1 | 61 | Francia |
| Champions League | 2 | Europa |
| Copa Libertadores | 13 | América del Sur |
| MLS | 253 | Estados Unidos |

---

## 💡 Casos de Uso Prácticos

### Caso 1: Mostrar últimos 5 partidos en la vista de un equipo

```typescript
// Frontend code
async function fetchTeamLastMatches(teamId: number, leagueId: number) {
  const response = await fetch(
    `http://localhost:4500/football/teams/${teamId}/last-matches?leagueId=${leagueId}&limit=5`
  );
  const data = await response.json();
  return data.data; // Array de fixtures
}

// Ejemplo de uso
const lastMatches = await fetchTeamLastMatches(489, 135); // AC Milan en Serie A
```

### Caso 2: Mostrar la temporada actual en la UI

```typescript
async function fetchCurrentSeason(leagueId: number) {
  const response = await fetch(
    `http://localhost:4500/football/leagues/${leagueId}/current-season`
  );
  const data = await response.json();
  return data.data.year; // Retorna el año de la temporada actual (ej: 2025)
}

// Ejemplo de uso
const currentSeasonYear = await fetchCurrentSeason(135); // Serie A
console.log(`Temporada actual: ${currentSeasonYear}`); // "Temporada actual: 2025"
```

### Caso 3: Mostrar partidos en la vista de un match

```typescript
async function fetchMatchDetails(fixtureId: number) {
  const response = await fetch(
    `http://localhost:4500/football/fixtures/${fixtureId}`
  );
  const data = await response.json();
  return data.data;
}

// Ejemplo de uso
const matchDetails = await fetchMatchDetails(1234567);
```

---

## 🚨 Solución al Problema Original

**Problema:** En la vista del match y en la vista del equipo se mostraba "2026" como temporada, lo cual era incorrecto.

**Solución:** Ahora todos los endpoints usan automáticamente la temporada actual (current: true) obtenida desde la API de api-sports.io.

**Antes (INCORRECTO):**
```typescript
// Hardcodeando el año
const season = 2026; // ❌ ESTO ESTÁ MAL
```

**Ahora (CORRECTO):**
```typescript
// Obteniendo dinámicamente la temporada actual
const currentSeason = await fetch('/football/leagues/135/current-season');
const season = currentSeason.data.year; // ✅ Siempre correcto
```

**Recomendación:** Al cargar la vista del equipo o del match, primero llama a `/football/leagues/:leagueId/current-season` para obtener la temporada correcta, y luego usa esa información para mostrar los datos relevantes.

---

## 🔍 Debugging y Logs

Si necesitas verificar qué temporada se está usando, puedes:

1. Consultar directamente el endpoint de temporada actual:
```bash
curl http://localhost:4500/football/leagues/135/current-season
```

2. Los logs del servidor mostrarán cualquier error de la API de api-sports.io

3. Todos los endpoints que usan temporadas incluyen el campo `season` en la respuesta

---

## 📝 Notas Importantes

1. **Rate Limits:** La API de api-sports.io tiene límites de requests. El plan gratuito permite 100 requests/día.

2. **API Key:** Asegúrate de tener tu API key configurada en el archivo `.env`:
   ```
   FOOTBALL_API_URL=https://v3.football.api-sports.io
   API_KEY=tu_api_key_aqui
   ```

3. **Caché:** Considera implementar caché para las temporadas actuales ya que no cambian frecuentemente.

4. **IDs de equipos y ligas:** Los IDs deben ser los de api-sports.io, no los de tu base de datos local.

5. **Swagger UI:** Explora todos estos endpoints interactivamente en:
   ```
   http://localhost:4500/swagger
   ```

---

## 🆘 Errores Comunes

### Error 400: "leagueId is required"
**Causa:** No se proporcionó el query parameter `leagueId`
**Solución:** Añade `?leagueId=135` a tu request

### Error 404: "No current season found"
**Causa:** La liga no tiene una temporada marcada como actual
**Solución:** Verifica el ID de la liga o consulta todas las temporadas

### Error 500: "Football API error"
**Causa:** Error al conectar con api-sports.io
**Solución:** Verifica tu API key, internet y límites de requests
