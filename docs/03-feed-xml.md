# Kickertech API — Parte 3: Feed XML (Sportsbook Sport Feed & Event Feed)

> **Alcance**: los dos endpoints que devuelven el **feed completo de cuotas** en formato XML. Son el corazón de la integración. Aquí están todos los datos que vamos a mostrarle al usuario en Minuto90: mercados, odds y betslips.

**Host**: `https://{SbxHost}` (asignado por Kickertech, distinto al host de discovery)
**Auth**: IP whitelist + `configId` + `configHash` embebidos en la URL
**Content-Type respuesta**: `application/xml` (o `text/xml`)

---

## Endpoint 5 — Sportsbook Sport Feed

### URL
```
GET https://{SbxHost}/affiliates/feeds/configs/{configId}/{configHash}?sport={sportId}
```

### Parámetros
| Param | Ubicación | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `configId` | path | `string/int` | ✅ | Provisto por Kickertech |
| `configHash` | path | `string` | ✅ | Provisto por Kickertech (secreto) |
| `sport` | query | `int` | ✅ | ID del deporte de `/sports` |

### Qué devuelve
**Todos los eventos activos de ese deporte, con todos sus mercados y todas sus odds**, en un único XML. Es la respuesta más pesada de toda la API.

### Casos de uso
- **Carga inicial** del feed en cache cada X minutos.
- Mostrar en Minuto90 listados de partidos *con cuotas* sin tener que pedir cada partido individualmente.
- Generar grids de "los partidos del día con sus cuotas 1X2".

### Estrategia de cache
- En **prematch**: refrescar cada 2–5 minutos.
- En **live**: refrescar cada 15–60 segundos (cuotas cambian rápido).
- **Importante**: este endpoint es pesado. No llamarlo desde el front. Backend lo trae, parsea, normaliza y guarda en Redis/DB con TTL corto. El front consulta nuestra DB, no Kickertech.

---

## Endpoint 6 — Sportsbook Event Feed

### URL
```
GET https://{SbxHost}/affiliates/feeds/configs/{configId}/{configHash}?sport={sportId}&eid={EventId}
```

### Parámetros
| Param | Ubicación | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `sport` | query | `int` | ✅ | ID del deporte |
| `eid` | query | `int` | ✅ | ID del evento (de `/events`) |

> ⚠️ El PDF tiene un typo: muestra `EvettId`. El nombre real del query param es **`eid`** y se llena con el `id` del evento.

### Qué devuelve
La misma estructura XML que el feed completo, pero filtrada a **un único evento**. Mucho más liviana.

### Casos de uso
- **Página de detalle de un partido** en Minuto90 — cuando el usuario clickea un partido y queremos mostrarle todos los mercados disponibles (no sólo el 1X2 sino over/under, handicaps, ambos marcan, scorers, etc.).
- **Refresh focalizado** durante el live. En vez de tirar el feed completo (pesado), se refresca sólo el evento que el usuario está viendo.
- **Webview / iframe del partido** con cuotas embebidas.

### Estrategia de cache
- En la página de detalle, refrescar cada 10–30s.
- TTL agresivamente corto si el evento es live (`is_live=1`).

---

## Estructura del XML — vista panorámica

```
<Sbx>
  <Sports>
    <Sport id name>
      <Country id name>
        <Tournament id name>
          <Event id start_date is_live linked_event_id home away betslip>
            <Market type_id>
              <Odd id name decimal price value />
              <Odd ... />
            </Market>
            <Market ...>
              ...
            </Market>
          </Event>
        </Tournament>
      </Country>
    </Sport>
  </Sports>
  <Markets>
    <Market type_id sport_id name />
    <Market ... />
  </Markets>
</Sbx>
```

**Dos bloques top-level dentro de `<Sbx>`:**
1. `<Sports>` — el árbol jerárquico de eventos con sus mercados y cuotas.
2. `<Markets>` — un **catálogo plano** de los tipos de mercado, con su `name` legible. Se usa para resolver qué significa cada `type_id` que aparece en el árbol.

> Esto es fundamental: el `<Market type_id="10001">` dentro de un evento **no trae el nombre del mercado**. Para saber que `10001` es "OVERTIME", hay que cruzarlo con `<Markets><Market type_id="10001" sport_id="1" name="OVERTIME"/></Markets>`. Diseñar el parser teniendo esto en cuenta.

---

## Detalle de cada nodo

### `Sbx` (raíz)
Contenedor del XML. Sin atributos. Children: `<Sports>`, `<Markets>`.

---

### `Sports`
Contenedor de elementos `<Sport>`. Sin atributos.

---

### `Sport`
Representa un deporte.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID del deporte (mismo que en `/sports`). |
| `name` | `string` | Nombre del deporte. |

Children: uno o más `<Country>`.

---

### `Country`
País/región.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | Mismo ID que en `/{sportId}/countries`. |
| `name` | `string` | Nombre del país. |

Children: uno o más `<Tournament>`.

---

### `Tournament`
Liga / competición.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | Mismo ID que en `/{sportId}/{countryId}/tournaments`. |
| `name` | `string` | Nombre del torneo. |

Children: uno o más `<Event>`.

---

### `Event`
Partido individual u outright.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID del evento (mismo que en `/{sportId}/{countryId}/{tournamentId}/events`). |
| `start_date` | `ISO 8601` | Fecha/hora UTC. |
| `is_live` | `boolean` (`"0"` o `"1"`) | `0` = prematch, `1` = en vivo. |
| `linked_event_id` | `int` | ID de un evento relacionado. `"0"` si no hay link. |
| `home` | `string` | Equipo local. En outrights, suele ser un título genérico ("Winner", "Outright Winner"). |
| `away` | `string` | Equipo visitante. **Vacío en outrights.** |
| `betslip` | `string` (URL) | URL de afiliado con placeholder `#ODD_ID`. Ver detalle abajo. |

Children: cero o más `<Market>`. (Un evento puede aparecer sin mercados — caso outright cerrado).

#### Sobre `linked_event_id`
Kickertech a veces publica el **mismo partido en dos versiones**: una prematch y otra en vivo, o regular time vs full time. El campo `linked_event_id` apunta al "hermano". Útil para no mostrar el partido duplicado al usuario.

#### Sobre `betslip`
Es la **URL de afiliado**. Trae literalmente el string `#ODD_ID`. Cuando el usuario clickea una cuota concreta:
1. Se toma el `id` del `<Odd>` que clickeó.
2. Se reemplaza `#ODD_ID` en la URL del evento por ese ID.
3. Se redirige al usuario a la URL resultante → cae en el sportsbook de Kickertech con esa cuota ya cargada en su carrito.

Ejemplo:
- `betslip` original: `https://affiliate-tglab/event/monaco-panathinaikos/3945939?betslip=#ODD_ID`
- Usuario elige odd `1469867745`
- URL final: `https://affiliate-tglab/event/monaco-panathinaikos/3945939?betslip=1469867745`

> Esto es lo que **monetiza** la integración. Cada click en una cuota debe construir esa URL y abrirla (en nueva pestaña, normalmente).

---

### `Market` (dentro de `Event`)
Tipo de apuesta concreto dentro de un partido.

| Atributo | Tipo | Descripción |
|---|---|---|
| `type_id` | `int` | ID del tipo de mercado. **Cruzar con `<Markets><Market>` del catálogo plano** para obtener el nombre. |

Children: uno o más `<Odd>`.

> **No tiene atributo `name`.** El nombre se resuelve por lookup contra el catálogo `Markets` al final del XML.

---

### `Odd` (dentro de `Market`)
Selección concreta apostable.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | `int` | ID único del odd. Es el que se inserta en `betslip` reemplazando `#ODD_ID`. |
| `name` | `string` | Nombre legible de la selección (ej: "Monaco", "Over 2.5", "Real Madrid", "X (regular time)"). |
| `decimal` | `decimal` | Cuota en formato decimal europeo (ej: `1.85`, `2.10`, `4.5`). **Es el formato principal a usar.** |
| `price` | `string` | Cuota en formato fraccional británico (ej: `"17/20"`, `"4/5"`, `"7/2"`). Para mostrar en mercados que prefieran ese formato. |
| `value` | `decimal` | **Parámetro del mercado.** Para handicaps y totales (ej: `2.5`, `-2.5`, `1`, `-1`). En mercados sin parámetro queda en `0`. |

#### Sobre `value` (clave para entender handicaps y over/under)
Cuando el mercado es de tipo handicap o totales, es el `value` el que indica el "punto" de la apuesta:
- `<Odd name="Monaco" decimal="1.72" value="1"/>` = handicap +1 a Monaco
- `<Odd name="Panathinaikos" decimal="2" value="-1"/>` = handicap -1 a Panathinaikos
- `<Odd name="Over" decimal="1.9" value="2.5"/>` = over 2.5
- `<Odd name="Under" decimal="1.9" value="2.5"/>` = under 2.5

Esto significa que **dentro de un mismo `<Market type_id="10100">` (handicaps) hay múltiples odds con el mismo `name` pero distinto `value`** (ver el ejemplo del XML de la doc, donde "Monaco" aparece con value 1, -1, 2, -2, 3, -3, 4, -4, 5...).

> Al mostrarlo en frontend, hay que **agrupar visualmente por `value`**.

---

### `Markets` (catálogo plano, hermano de `<Sports>`)
Diccionario de todos los `type_id` que aparecieron en el árbol, con su nombre legible.

---

### `Market` (dentro de `<Markets>`, no confundir con el de eventos)

| Atributo | Tipo | Descripción |
|---|---|---|
| `type_id` | `int` | El ID que aparece en `Event.Market.type_id`. **Clave de cruce.** |
| `sport_id` | `int` | A qué deporte aplica. |
| `name` | `string` | Nombre legible (ej: `"Winner | Winner"`, `"OVERTIME"`, `"REGULAR TIME | Main line"`, `"HANDICAPS"`). |

#### Convención de naming
Los nombres usan `|` como separador jerárquico (categoría | subcategoría). Para frontend, conviene splittearlo y usarlo como agrupador (ej: agrupar todos los markets que empiezan con `"REGULAR TIME |"`).

---

## Ejemplo simplificado del XML (anotado)

```xml
<Sbx>
  <Sports>
    <Sport id="1" name="Basketball">
      <Country id="17" name="Europe">
        <Tournament id="4723" name="Euroleague">
          <Event id="3945939"
                 start_date="2021-09-30T17:00:00.000Z"
                 is_live="0"
                 linked_event_id="0"
                 home="Monaco"
                 away="Panathinaikos"
                 betslip="https://affiliate-tglab/event/monaco-panathinaikos/3945939?betslip=#ODD_ID">

            <!-- Mercado 1X2 (over time incluido) -->
            <Market type_id="10001">
              <Odd id="1469867745" name="Monaco"        decimal="1.8" price="4/5"  value="0"/>
              <Odd id="1469867746" name="Panathinaikos" decimal="1.9" price="9/10" value="0"/>
            </Market>

            <!-- 1X2 sólo tiempo regular (puede haber empate) -->
            <Market type_id="10002">
              <Odd id="1469867747" name="Monaco (regular time)"        decimal="1.87" value="0"/>
              <Odd id="1469867748" name=" X (regular time)"            decimal="14"   value="0"/>
              <Odd id="1469867749" name="Panathinaikos (regular time)" decimal="2"    value="0"/>
            </Market>

            <!-- Handicaps (mismo type_id, varios values) -->
            <Market type_id="10100">
              <Odd id="1469867750" name="Monaco"        decimal="1.72" value="1"/>
              <Odd id="1469867751" name="Panathinaikos" decimal="2"    value="-1"/>
              <Odd id="1469867752" name="Monaco"        decimal="1.85" value="-1"/>
              <Odd id="1469867753" name="Panathinaikos" decimal="1.85" value="1"/>
              <!-- ...sigue con value=2,-2,3,-3, etc. -->
            </Market>
          </Event>
        </Tournament>
      </Country>
    </Sport>
  </Sports>

  <!-- Catálogo plano: resolver type_id → nombre -->
  <Markets>
    <Market type_id="10001" sport_id="1" name="OVERTIME"/>
    <Market type_id="10002" sport_id="1" name="REGULAR TIME | Main line"/>
    <Market type_id="10100" sport_id="1" name="HANDICAPS"/>
  </Markets>
</Sbx>
```

---

## Modelo conceptual normalizado (para guiar la DB)

A nivel relacional, esto sugiere las siguientes entidades en nuestro lado:

```
kickertech_sport       (id, name)
kickertech_country     (id, name, sport_id)
kickertech_tournament  (id, name, country_id, sport_id, mapped_apifootball_league_id)
kickertech_event       (id, tournament_id, home, away, start_date, is_live,
                        linked_event_id, betslip_template,
                        mapped_apifootball_fixture_id)
kickertech_market_type (type_id, sport_id, name)            -- catálogo de Markets
kickertech_event_market(event_id, type_id)                  -- mercados activos por evento
kickertech_odd         (id, event_id, type_id, name,
                        decimal_value, fractional_value, param_value, fetched_at)
```

> El campo `fetched_at` en `kickertech_odd` es clave para invalidación de cache: cualquier odd más viejo que X segundos se considera obsoleto.

---

## Notas de parsing

### Decisión de librería (conceptual)
- En Node/TS: `fast-xml-parser` o `xml2js`. El primero es más rápido y maneja mejor atributos.
- Configurar el parser para que **trate atributos como propiedades** del objeto (no anidarlos en `$` o `@_`).
- Importante: **`is_live` viene como string `"0"`/`"1"`**, no como booleano. Convertir explícitamente.
- **`value`** puede venir como string `"2.5"` o `"-2.5"`. Parsear a `number` con cuidado de no perder el signo.

### Tamaño y streaming
El feed completo (`?sport=`) puede ser de **varios MB**. Si el agente lo procesa de manera no-streaming, asegurarse de que el parser no cargue todo en memoria a la vez. Para deportes muy grandes (fútbol, baloncesto), considerar streaming SAX-style o limitar por país/torneo.

### Caracteres especiales
El ejemplo del PDF tiene `&#x9;` (tab) embebido en un nombre de equipo (`Fenerbahce&#x9;`). El parser estándar lo decodifica solo, pero hay que **trimear los nombres** después de parsear.

---

## Continuación

- **Parte 4**: la integración real con api-football, mapeo de IDs, normalización de nombres, caching, roadmap de implementación por fases.
