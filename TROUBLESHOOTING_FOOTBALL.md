# Troubleshooting - Football Endpoints

## 🔍 Problema: No se muestran los últimos 5 partidos

### Cambios Realizados

He corregido la lógica de obtención de partidos. El problema era que el parámetro `last` de la API de api-sports.io no estaba funcionando correctamente.

**Solución implementada:**

1. **Obtener TODOS los partidos** del equipo en la temporada actual
2. **Filtrar** los partidos finalizados (status: FT, AET, PEN, etc.)
3. **Ordenar** por fecha descendente (más recientes primero)
4. **Tomar** los primeros N (límite)

### Logs de Debugging

El servicio ahora imprime logs en la consola para debugging:

```
[getTeamLastMatches] Team: 489, League: 135, Season: 2024
[getTeamLastMatches] Total fixtures found: 23
[getTeamLastMatches] Finished fixtures: 18
[getTeamLastMatches] Returning 5 fixtures
```

---

## 🧪 Cómo Probar

### 1. Iniciar el servidor

```bash
cd /mnt/c/Users/johan/Desktop/code/minuto90-slime/minuto90-backend
bun run src/index.ts
```

### 2. Probar con curl

**Obtener la temporada actual de Serie A:**
```bash
curl "http://localhost:4500/football/leagues/135/current-season"
```

**Obtener últimos 5 partidos de AC Milan en Serie A:**
```bash
curl "http://localhost:4500/football/teams/489/last-matches?leagueId=135&limit=5"
```

**Obtener próximos 5 partidos de AC Milan:**
```bash
curl "http://localhost:4500/football/teams/489/next-matches?leagueId=135&limit=5"
```

### 3. Probar con el navegador

Simplemente abre estas URLs en tu navegador:

```
http://localhost:4500/football/leagues/135/current-season
http://localhost:4500/football/teams/489/last-matches?leagueId=135&limit=5
```

### 4. Ver los logs

Los logs se imprimirán en la consola donde iniciaste el servidor. Verás algo como:

```
[getTeamLastMatches] Team: 489, League: 135, Season: 2024
[getTeamLastMatches] Total fixtures found: 23
[getTeamLastMatches] Finished fixtures: 18
[getTeamLastMatches] Returning 5 fixtures
```

---

## ❓ Posibles Problemas y Soluciones

### Problema 1: "No current season found for this league"

**Causa:** La liga no tiene una temporada marcada como `current: true`

**Solución:**
1. Verifica que el `leagueId` sea correcto
2. Prueba primero el endpoint de todas las temporadas:
   ```bash
   curl "http://localhost:4500/football/leagues/135/seasons"
   ```
3. Verifica que al menos una temporada tenga `current: true`

---

### Problema 2: "Total fixtures found: 0"

**Causa:** La API no encontró partidos para ese equipo en esa liga/temporada

**Posibles razones:**
1. **ID de equipo incorrecto**: El `teamId` no corresponde al equipo en esa liga
2. **ID de liga incorrecto**: El `leagueId` no es correcto
3. **Sin partidos en la temporada actual**: El equipo aún no ha jugado partidos

**Solución:**
1. Verifica los IDs en la API de api-sports.io:
   - Web: https://www.api-football.com/
   - Documentación: https://www.api-football.com/documentation-v3

2. Prueba con IDs conocidos:
   ```bash
   # Real Madrid en La Liga
   curl "http://localhost:4500/football/teams/541/last-matches?leagueId=140&limit=5"

   # Barcelona en La Liga
   curl "http://localhost:4500/football/teams/529/last-matches?leagueId=140&limit=5"

   # Manchester City en Premier League
   curl "http://localhost:4500/football/teams/50/last-matches?leagueId=39&limit=5"
   ```

---

### Problema 3: "Finished fixtures: 0" pero hay partidos

**Causa:** Los partidos no tienen status "FT", "AET", "PEN", etc.

**Solución:**
1. Obtener todos los partidos sin filtrar para ver los status:
   ```bash
   curl "http://localhost:4500/football/teams/489/fixtures?leagueId=135"
   ```

2. Ver qué status tienen los partidos en la respuesta

3. Si necesitas incluir otros status, edita el archivo:
   `/src/features/sports/football/application/football.service.ts`

   Línea 60, agrega los status necesarios:
   ```typescript
   const finishedStatuses = ["FT", "AET", "PEN", "AWD", "WO", "OTRO_STATUS"];
   ```

---

### Problema 4: Error de API Key

**Error:**
```json
{
  "error": "Football API error: 401 Unauthorized"
}
```

**Causa:** La API key no es válida o ha excedido el límite de requests

**Solución:**
1. Verifica tu API key en el archivo `.env`:
   ```env
   API_KEY=tu_api_key_aqui
   ```

2. Verifica el límite de requests:
   - Plan gratuito: 100 requests/día
   - Puedes ver tu uso en: https://dashboard.api-football.com/

3. Si excediste el límite, espera 24 horas o actualiza tu plan

---

### Problema 5: "leagueId is required as query parameter"

**Causa:** No se proporcionó el parámetro `leagueId` en la URL

**Solución:**
Asegúrate de incluir `?leagueId=135` en la URL:

❌ **Incorrecto:**
```
http://localhost:4500/football/teams/489/last-matches
```

✅ **Correcto:**
```
http://localhost:4500/football/teams/489/last-matches?leagueId=135
```

---

## 🎯 IDs de Equipos y Ligas Comunes

### Ligas
| Liga | ID |
|------|-----|
| Serie A (Italia) | 135 |
| La Liga (España) | 140 |
| Premier League (Inglaterra) | 39 |
| Bundesliga (Alemania) | 78 |
| Ligue 1 (Francia) | 61 |
| Champions League | 2 |

### Equipos en Serie A
| Equipo | ID |
|--------|-----|
| AC Milan | 489 |
| Inter | 505 |
| Juventus | 496 |
| Napoli | 492 |
| Roma | 497 |
| Lazio | 487 |
| Atalanta | 499 |

### Equipos en La Liga
| Equipo | ID |
|--------|-----|
| Real Madrid | 541 |
| Barcelona | 529 |
| Atlético Madrid | 530 |
| Sevilla | 536 |

### Equipos en Premier League
| Equipo | ID |
|--------|-----|
| Manchester City | 50 |
| Liverpool | 40 |
| Arsenal | 42 |
| Manchester United | 33 |
| Chelsea | 49 |

---

## 🔧 Debug Avanzado

### Ver todos los partidos sin filtrar

```bash
curl "http://localhost:4500/football/teams/489/fixtures?leagueId=135" | jq '.data.fixtures[] | {date: .fixture.date, status: .fixture.status.short, home: .teams.home.name, away: .teams.away.name}'
```

### Ver solo los status de los partidos

```bash
curl "http://localhost:4500/football/teams/489/fixtures?leagueId=135" | jq '.data.fixtures[].fixture.status.short' | sort | uniq -c
```

### Ver los últimos 10 partidos ordenados

```bash
curl "http://localhost:4500/football/teams/489/last-matches?leagueId=135&limit=10" | jq '.data[] | {date: .fixture.date, home: .teams.home.name, away: .teams.away.name, score: "\(.goals.home) - \(.goals.away)"}'
```

---

## 📊 Ejemplo de Respuesta Exitosa

**Request:**
```bash
curl "http://localhost:4500/football/teams/529/last-matches?leagueId=140&limit=2"
```

**Response:**
```json
{
  "data": [
    {
      "fixture": {
        "id": 1234567,
        "date": "2024-12-22T20:00:00+00:00",
        "timestamp": 1703275200,
        "status": {
          "long": "Match Finished",
          "short": "FT",
          "elapsed": 90
        },
        "venue": {
          "name": "Spotify Camp Nou",
          "city": "Barcelona"
        }
      },
      "league": {
        "id": 140,
        "name": "La Liga",
        "season": 2024
      },
      "teams": {
        "home": {
          "id": 529,
          "name": "Barcelona",
          "winner": true
        },
        "away": {
          "id": 727,
          "name": "Almería",
          "winner": false
        }
      },
      "goals": {
        "home": 3,
        "away": 1
      }
    },
    {
      "fixture": {
        "id": 1234566,
        "date": "2024-12-18T21:00:00+00:00",
        "timestamp": 1702929600,
        "status": {
          "long": "Match Finished",
          "short": "FT",
          "elapsed": 90
        }
      },
      "teams": {
        "home": {
          "id": 798,
          "name": "Mallorca",
          "winner": false
        },
        "away": {
          "id": 529,
          "name": "Barcelona",
          "winner": true
        }
      },
      "goals": {
        "home": 0,
        "away": 1
      }
    }
  ],
  "meta": {
    "count": 2,
    "limit": 2
  }
}
```

---

## 💡 Recomendaciones

1. **Caché**: Considera implementar caché para las temporadas actuales ya que no cambian frecuentemente

2. **Rate Limiting**: Implementa un sistema de rate limiting en tu frontend para no exceder los límites de la API

3. **IDs dinámicos**: Guarda los IDs de api-sports.io en tu base de datos junto con tus IDs locales para hacer la conversión

4. **Fallback**: Si no hay partidos en la temporada actual, muestra un mensaje amigable al usuario

5. **Manejo de errores**: Implementa un manejo de errores robusto en el frontend para mostrar mensajes claros

---

## 📞 Contacto y Soporte

Si sigues teniendo problemas:

1. Revisa los logs del servidor
2. Verifica tu API key y límites
3. Prueba con IDs conocidos de la lista anterior
4. Verifica que el servidor esté corriendo en el puerto 4500
5. Usa Swagger UI para probar interactivamente: http://localhost:4500/swagger
