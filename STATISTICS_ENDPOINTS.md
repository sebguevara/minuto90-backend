# Endpoints de Estadísticas

Documentación completa de los endpoints para consumir estadísticas de equipos y jugadores desde el frontend.

## Base URL
```
http://localhost:4500/stats/statistics
```

## Autenticación
Estos son endpoints READ-ONLY que no requieren autenticación.

---

## 📊 Estadísticas de Equipos

### 1. Estadísticas de Resumen de Equipos

**Endpoint:** `GET /statistics/teams/:tournamentId/summary`

**Descripción:** Obtiene estadísticas resumidas de equipos en un torneo (goles, tiros, tarjetas, posesión, pases, duelos aéreos, rating).

**Parámetros de ruta:**
- `tournamentId` (requerido): ID del torneo

**Query parameters:**
- `viewTypeId` (requerido): ID del tipo de vista (por ejemplo: 0 = todo el torneo, otros IDs para vistas específicas)
- `categoryId` (opcional): ID de la categoría
- `sectionId` (opcional): ID de la sección
- `limit` (opcional, default: 20): Límite de resultados
- `offset` (opcional, default: 0): Offset para paginación

**Ejemplo:**
```bash
GET /statistics/teams/32/summary?viewTypeId=0&limit=10
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "tournamentId": 32,
      "teamId": 123,
      "rank": 1,
      "goals": 45,
      "shotsPg": 12.5,
      "yellow": 30,
      "red": 2,
      "possession": 55.3,
      "pass": 85.2,
      "aerialsWon": 48.5,
      "rating": 7.2,
      "Team": {
        "id": 123,
        "name": "Real Madrid",
        "Country": {
          "name": "Spain"
        }
      },
      "Tournament": {
        "name": "LaLiga"
      }
    }
  ],
  "meta": {
    "limit": 10,
    "offset": 0,
    "count": 20
  }
}
```

---

### 2. Estadísticas Defensivas de Equipos

**Endpoint:** `GET /statistics/teams/:tournamentId/defensive`

**Descripción:** Estadísticas defensivas (tiros pg, tackles pg, intercepciones pg, faltas pg, fueras de juego pg).

**Parámetros:** Idénticos a las estadísticas de resumen.

**Ejemplo:**
```bash
GET /statistics/teams/32/defensive?viewTypeId=0
```

---

### 3. Estadísticas Ofensivas de Equipos

**Endpoint:** `GET /statistics/teams/:tournamentId/offensive`

**Descripción:** Estadísticas ofensivas (tiros pg, tiros a portería pg, regates pg, faltas recibidas pg).

**Ejemplo:**
```bash
GET /statistics/teams/32/offensive?viewTypeId=0
```

---

### 4. Estadísticas de xG (Expected Goals) de Equipos

**Endpoint:** `GET /statistics/teams/:tournamentId/xg`

**Descripción:** Estadísticas de Expected Goals (xG, goles, diferencia xG, tiros, xG por tiro).

**Query parameters adicionales:**
- `sectionId` puede ser usado para filtrar por "for" (a favor) o "against" (en contra)

**Ejemplo:**
```bash
GET /statistics/teams/32/xg?viewTypeId=0&sectionId=1
```

---

## 👤 Estadísticas de Jugadores

### 5. Estadísticas de Resumen de Jugadores

**Endpoint:** `GET /statistics/players/:tournamentId/summary`

**Descripción:** Estadísticas resumidas de jugadores (goles, asistencias, tarjetas, tiros, pases, duelos aéreos, rating).

**Parámetros:** Idénticos a las estadísticas de equipos.

**Ejemplo:**
```bash
GET /statistics/players/32/summary?viewTypeId=0&limit=20
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "tournamentId": 32,
      "playerId": 456,
      "teamId": 123,
      "rank": 1,
      "apps": "30(2)",
      "minsPlayed": 2700,
      "goals": 25,
      "assists": 12,
      "yellow": 3,
      "red": 0,
      "shotsPerGame": 4.2,
      "passSuccess": 88.5,
      "aerialsWon": 2.1,
      "motm": 8,
      "rating": 7.8,
      "Player": {
        "id": 456,
        "name": "Karim Benzema",
        "Country": {
          "name": "France"
        }
      },
      "Team": {
        "name": "Real Madrid"
      }
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0,
    "count": 350
  }
}
```

---

### 6. Estadísticas Defensivas de Jugadores

**Endpoint:** `GET /statistics/players/:tournamentId/defensive`

**Descripción:** Estadísticas defensivas de jugadores (tackles, intercepciones, faltas, despejes, etc.).

**Ejemplo:**
```bash
GET /statistics/players/32/defensive?viewTypeId=0
```

---

### 7. Estadísticas Ofensivas de Jugadores

**Endpoint:** `GET /statistics/players/:tournamentId/offensive`

**Descripción:** Estadísticas ofensivas de jugadores (tiros, tiros a portería, pases clave, regates, etc.).

**Ejemplo:**
```bash
GET /statistics/players/32/offensive?viewTypeId=0
```

---

### 8. Estadísticas de Pases de Jugadores

**Endpoint:** `GET /statistics/players/:tournamentId/passing`

**Descripción:** Estadísticas de pases (pases clave, pases totales, precisión, centros, pases largos, etc.).

**Ejemplo:**
```bash
GET /statistics/players/32/passing?viewTypeId=0
```

---

### 9. Estadísticas de xG de Jugadores

**Endpoint:** `GET /statistics/players/:tournamentId/xg`

**Descripción:** Estadísticas de Expected Goals de jugadores (xG, npxG, xG assist, xG chain, xG buildup).

**Ejemplo:**
```bash
GET /statistics/players/32/xg?viewTypeId=0
```

---

## 🔥 Rachas de Equipos

### 10. Rachas de Equipos

**Endpoint:** `GET /statistics/teams/:tournamentId/streaks`

**Descripción:** Rachas de equipos (victorias consecutivas, derrotas, empates, sin perder, etc.).

**Query parameters:**
- `viewTypeId` (requerido): ID del tipo de vista
- `mode` (opcional, default: "all"): "all" | "home" | "away"
- `scope` (opcional, default: "Current"): "Current" | "Season" | "Historical"
- `limit` (opcional, default: 20)
- `offset` (opcional, default: 0)

**Ejemplo:**
```bash
GET /statistics/teams/32/streaks?viewTypeId=0&mode=all&scope=Current
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "tournamentId": 32,
      "teamId": 123,
      "streakType": "wins",
      "scope": "Current",
      "rank": 1,
      "streakCount": 8,
      "matchesPlayed": 30,
      "mode": "all",
      "Team": {
        "name": "Barcelona"
      }
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0,
    "count": 20
  }
}
```

---

## 📈 Rendimientos de Equipos

### 11. Rendimiento de Equipos

**Endpoint:** `GET /statistics/teams/:tournamentId/performance`

**Descripción:** Rendimiento de equipos (partidos jugados, % victorias, % empates, % derrotas, goles a favor/contra por partido, puntos por partido).

**Query parameters:**
- `viewTypeId` (requerido): ID del tipo de vista
- `mode` (opcional, default: "all"): "all" | "home" | "away"
- `limit` (opcional, default: 20)
- `offset` (opcional, default: 0)

**Ejemplo:**
```bash
GET /statistics/teams/32/performance?viewTypeId=0&mode=home
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "tournamentId": 32,
      "teamId": 123,
      "category": "overall",
      "rank": 1,
      "matchesPlayed": 30,
      "winPercentage": 66,
      "drawPercentage": 20,
      "lossPercentage": 14,
      "goalsForPg": 2.1,
      "goalsAgainstPg": 0.8,
      "pointsPg": 2.38,
      "mode": "home",
      "Team": {
        "name": "Manchester City"
      }
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0,
    "count": 20
  }
}
```

---

## 🌟 XI Ideal

### 12. Once Ideal del Torneo

**Endpoint:** `GET /statistics/tournaments/:tournamentId/best-xi`

**Descripción:** Once ideal del torneo según el timeframe (semanal, mensual o temporada completa).

**Query parameters:**
- `timeframe` (opcional, default: "season"): "weekly" | "monthly" | "season"
- `startDate` (opcional): Fecha de inicio en formato ISO (solo si timeframe es custom)
- `endDate` (opcional): Fecha de fin en formato ISO (solo si timeframe es custom)

**Ejemplo:**
```bash
GET /statistics/tournaments/32/best-xi?timeframe=monthly
```

**Respuesta:**
```json
{
  "data": {
    "id": 1,
    "tournamentId": 32,
    "timeframe": "monthly",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "formation": "4-3-3",
    "Tournament": {
      "name": "LaLiga"
    },
    "BestXIPlayer": [
      {
        "id": 1,
        "playerName": "Marc-André ter Stegen",
        "rating": 7.8,
        "positionLabel": "GK",
        "positionIndex": 0,
        "Player": {
          "name": "Marc-André ter Stegen",
          "Country": {
            "name": "Germany"
          }
        },
        "Team": {
          "name": "Barcelona"
        }
      }
      // ... más jugadores ordenados por positionIndex
    ]
  }
}
```

---

## 🏆 Top Jugadores (Líderes)

### 13. Jugadores con Mejor Rating

**Endpoint:** `GET /statistics/tournaments/:tournamentId/top-players/rating`

**Query parameters:**
- `viewTypeId` (requerido): ID del tipo de vista
- `limit` (opcional, default: 10): Cantidad de jugadores a retornar

**Ejemplo:**
```bash
GET /statistics/tournaments/32/top-players/rating?viewTypeId=0&limit=10
```

---

### 14. Jugadores con Más Asistencias

**Endpoint:** `GET /statistics/tournaments/:tournamentId/top-players/assists`

**Ejemplo:**
```bash
GET /statistics/tournaments/32/top-players/assists?viewTypeId=0&limit=10
```

---

### 15. Jugadores con Más Tiros

**Endpoint:** `GET /statistics/tournaments/:tournamentId/top-players/shots`

**Ejemplo:**
```bash
GET /statistics/tournaments/32/top-players/shots?viewTypeId=0&limit=10
```

---

### 16. Jugadores Más Agresivos (Tarjetas)

**Endpoint:** `GET /statistics/tournaments/:tournamentId/top-players/aggression`

**Ejemplo:**
```bash
GET /statistics/tournaments/32/top-players/aggression?viewTypeId=0&limit=10
```

---

### 17. Jugadores con Mayor Contribución de Goles

**Endpoint:** `GET /statistics/tournaments/:tournamentId/top-players/goal-contribution`

**Descripción:** Jugadores con mayor porcentaje de contribución a los goles de su equipo.

**Ejemplo:**
```bash
GET /statistics/tournaments/32/top-players/goal-contribution?viewTypeId=0&limit=10
```

---

## 🔍 Valores Comunes de Parámetros

### viewTypeId
- `0`: Todo el torneo (vista general)
- Otros valores específicos según la configuración de tu base de datos

### mode (para rachas y rendimiento)
- `all`: Todos los partidos
- `home`: Solo partidos de local
- `away`: Solo partidos de visitante

### scope (para rachas)
- `Current`: Racha actual
- `Season`: Mejor racha de la temporada
- `Historical`: Racha histórica

### timeframe (para XI Ideal)
- `weekly`: Semanal
- `monthly`: Mensual
- `season`: Temporada completa

---

## 📝 Notas Importantes

1. **Paginación:** Todos los endpoints de listas soportan paginación mediante `limit` y `offset`.

2. **viewTypeId:** Este parámetro es crucial y determina el contexto de la vista de estadísticas. Asegúrate de consultar con tu base de datos cuáles son los valores válidos.

3. **Relaciones incluidas:** Todos los endpoints incluyen las relaciones necesarias (Team, Player, Country, Tournament) para mostrar información completa sin necesidad de consultas adicionales.

4. **Swagger UI:** Puedes explorar todos estos endpoints interactivamente en:
   ```
   http://localhost:4500/swagger
   ```

5. **Errores:**
   - `400 Bad Request`: Parámetros inválidos
   - `404 Not Found`: Recurso no encontrado
   - `500 Internal Server Error`: Error del servidor

---

## 🚀 Ejemplo de Uso en Frontend

```typescript
// Ejemplo en React/TypeScript

// Obtener estadísticas resumidas de equipos
const fetchTeamSummary = async (tournamentId: number) => {
  const response = await fetch(
    `http://localhost:4500/stats/statistics/teams/${tournamentId}/summary?viewTypeId=0&limit=20`
  );
  const data = await response.json();
  return data;
};

// Obtener XI Ideal mensual
const fetchBestXI = async (tournamentId: number) => {
  const response = await fetch(
    `http://localhost:4500/stats/statistics/tournaments/${tournamentId}/best-xi?timeframe=monthly`
  );
  const data = await response.json();
  return data;
};

// Obtener top 10 goleadores
const fetchTopScorers = async (tournamentId: number) => {
  const response = await fetch(
    `http://localhost:4500/stats/statistics/players/${tournamentId}/summary?viewTypeId=0&limit=10`
  );
  const data = await response.json();
  // Ordenar por goles si es necesario
  return data.data.sort((a, b) => b.goals - a.goals);
};
```

---

## 📊 Estructura de la Sección "Estadísticas" en el Frontend

Basándome en los endpoints disponibles, aquí hay una sugerencia de cómo estructurar la sección de estadísticas en tu frontend:

```
Estadísticas
├── Equipos
│   ├── Resumen
│   ├── Defensivo
│   ├── Ofensivo
│   └── xG (Expected Goals)
├── Jugadores
│   ├── Resumen
│   ├── Defensivo
│   ├── Ofensivo
│   ├── Pases
│   └── xG
├── Rachas
│   ├── Victorias consecutivas
│   ├── Sin perder
│   ├── Sin ganar
│   └── Otras rachas
├── Rendimientos
│   ├── General
│   ├── Local
│   └── Visitante
└── XI Ideal
    ├── Semanal
    ├── Mensual
    └── Temporada
```

Cada sección puede consumir los endpoints correspondientes para mostrar la información relevante.
