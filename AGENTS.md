# AGENTS.md

## Propósito

Este documento define cómo deben trabajar los agentes dentro del backend de Minuto90.

Su objetivo es asegurar que cualquier cambio, implementación, refactor o integración se haga de forma consistente, predecible, mantenible, clara, precisa y alineada con arquitectura limpia.

Este archivo no describe solamente estilo de código. También define la forma de pensar, la forma de responder, la forma de organizar el sistema y la forma correcta de consultar datos externos.

---

## Idioma y formato de respuestas

Los agentes deben responder siempre en español, salvo que se pida explícitamente otro idioma.

Las respuestas deben seguir estas reglas:

1. Ser claras, directas y precisas.
2. Evitar ambigüedad, relleno o explicaciones innecesarias.
3. Mantener el mismo estilo de respuesta a lo largo del proyecto.
4. Cuando haya errores, los mensajes de error que se devuelven al cliente deben estar en español.
5. La documentación, decisiones técnicas y justificaciones también deben escribirse de forma clara y ordenada.
6. Si hay incertidumbre técnica, debe indicarse con honestidad en vez de inventar una solución.

### Regla de errores

Todos los errores expuestos hacia afuera deben estar normalizados y en español.

Ejemplos:

- `Partido no encontrado`
- `No se pudo obtener la información de la liga`
- `La consulta excedió el límite permitido`
- `La sesión es inválida o expiró`
- `No hay datos disponibles para esta búsqueda`

No se deben filtrar errores crudos de infraestructura, librerías, Redis, base de datos o APIs externas al cliente final.

---

## Forma de trabajar

Los agentes deben trabajar bajo una lógica de ingeniería disciplinada, no improvisada.

### Principios operativos

1. Antes de implementar, entender el módulo y el dominio involucrado.
2. Antes de agregar archivos o carpetas, decidir si se trata de:
   - un módulo de negocio
   - un adaptador técnico
   - un componente compartido
   - un caso de uso
3. Antes de escribir lógica, verificar si ya existe una implementación reutilizable.
4. Antes de consultar una API externa, verificar primero Redis según la política de caché.
5. Antes de devolver un error, traducirlo a un error claro de negocio en español.
6. Antes de cerrar una tarea, validar consistencia arquitectónica, nombres y responsabilidad de archivos.

### Regla de implementación

Cada cambio debe intentar dejar el sistema mejor que antes.

Si una implementación nueva obliga a repetir lógica, mezclar capas o romper convenciones, entonces la solución no está terminada.

---

## Arquitectura limpia

El sistema debe organizarse por módulos de negocio y, dentro de cada módulo, por capas.

La estructura base debe seguir esta idea:

~~~txt
src/
  modules/
    sports/
    notifications/
    stats/
  shared/
  workers/
  config/
  bootstrap/
  server.ts
~~~

Dentro de cada módulo, las capas deben estar claramente separadas.

### Capas

#### Domain

Contiene reglas puras de negocio.

Incluye:

- entidades
- value objects
- errores de dominio
- contratos de repositorios
- reglas e invariantes

No incluye:

- Elysia
- Redis
- consultas HTTP
- acceso a APIs externas
- SQL

#### Application

Contiene los casos de uso.

Incluye:

- use cases
- DTOs de aplicación
- contratos para dependencias externas
- coordinación de repositorios y servicios

No incluye:

- detalles de framework
- acceso directo a Redis
- acceso directo a API-Football
- acceso directo a base de datos

#### Infrastructure

Contiene implementaciones concretas.

Incluye:

- clientes HTTP
- adaptadores hacia API-Football
- repositorios concretos
- implementaciones Redis
- persistencia
- proveedores externos

#### Presentation

Contiene la capa de entrada/salida.

Incluye:

- rutas Elysia
- validaciones HTTP
- mapeo de respuestas
- traducción de errores a status HTTP

No incluye lógica de negocio.

---

## Convenciones de diseño

### Un archivo, una responsabilidad

Cada archivo debe tener una responsabilidad primaria.

Ejemplos válidos:

~~~txt
get-live-fixtures.use-case.ts
fixture.entity.ts
api-football-fixture.provider.ts
redis-fixture-cache.repository.ts
fixture-response.mapper.ts
get-live-fixtures.route.ts
get-live-fixtures.schema.ts
build-fixture-cache-key.ts
~~~

No se deben crear archivos genéricos como:

- `utils.ts`
- `helpers.ts`
- `common.ts`
- `misc.ts`
- `service.ts` gigante con múltiples responsabilidades

### Nombres

Los nombres deben ser explícitos.

Preferir:

- `get-team-standings.use-case.ts`
- `api-football-team.provider.ts`
- `redis-match-cache.service.ts`
- `team-response.mapper.ts`

Evitar:

- `service.ts`
- `manager.ts`
- `tool.ts`
- `functions.ts`

---

## SOLID

Los agentes deben aplicar SOLID como regla práctica, no como adorno teórico.

### Single Responsibility Principle

Una clase, función o archivo debe tener un solo motivo principal de cambio.

### Open/Closed Principle

La lógica debe poder extenderse sin reescribir el núcleo estable.

### Liskov Substitution Principle

Toda implementación de un contrato debe comportarse de manera consistente.

### Interface Segregation Principle

Las interfaces deben ser pequeñas y enfocadas.

### Dependency Inversion Principle

Los casos de uso deben depender de contratos, no de implementaciones concretas.

---

## Regla crítica de caché con Redis

Esta regla es obligatoria y es una de las más importantes del proyecto.

Toda consulta de datos externos, especialmente contra API-Football, debe seguir este flujo:

1. Construir la clave de caché correspondiente.
2. Consultar Redis primero.
3. Verificar si existe un valor válido en Redis.
4. Verificar si el TTL de esa consulta sigue vigente.
5. Si el valor existe y el TTL sigue vigente, devolver directamente el valor desde Redis.
6. Si el valor no existe o el TTL venció, hacer la petición externa.
7. Guardar el nuevo resultado en Redis con el TTL correspondiente.
8. Devolver el valor recién guardado en Redis.

### Regla funcional obligatoria

Nunca consultar primero la API externa si esa consulta puede resolverse desde Redis.

Redis es la primera fuente de lectura para datos cacheables.

### Comportamiento esperado

#### Caso 1: caché válida

- existe clave en Redis
- TTL vigente
- se responde con Redis
- no se llama a API-Football

#### Caso 2: caché vencida o inexistente

- no existe clave o ya expiró
- se consulta API-Football
- se guarda el nuevo valor en Redis
- se responde con el valor actualizado

### Regla de devolución

Cuando se refresca la información, el valor que se devuelve debe ser el valor persistido en Redis o el equivalente recién almacenado bajo esa política. La fuente oficial del resultado cacheado pasa a ser Redis.

---

## Política de TTL

No todos los deportes, recursos o tipos de consulta deben tener el mismo TTL.

Cada deporte y cada tipo de dato deben manejar TTLs distintos según:

- volatilidad del dato
- frecuencia de actualización real
- costo de consultar API-Football
- sensibilidad del producto a la latencia
- criticidad de tener datos frescos

### Regla obligatoria

Los TTLs deben estar centralizados en configuración o en una política de caché dedicada. No deben estar hardcodeados de forma dispersa en los casos de uso.

Ejemplo conceptual:

~~~txt
shared/
  application/
    cache/
      cache-ttl.policy.ts
~~~

O por módulo:

~~~txt
modules/sports/
  application/
    cache/
      sports-cache-ttl.policy.ts
~~~

### Ejemplo conceptual de TTLs distintos

Esto es solo una referencia estructural. Los valores concretos deben definirse según el negocio.

- partidos en vivo: TTL corto
- estadísticas en vivo: TTL muy corto
- standings: TTL medio
- información de ligas: TTL largo
- información de equipos: TTL largo
- historial cerrado: TTL más largo

### Regla de diseño

Los agentes no deben inventar TTLs por conveniencia dentro de una función.

Los TTLs deben salir de una política explícita, mantenible y visible.

---

## Integración con API-Football

La integración con api-football.com debe estar encapsulada en infraestructura.

Nunca debe haber llamadas directas a esa API desde:

- routes
- controllers
- use cases
- mappers

Debe existir un adaptador o provider claro, por ejemplo:

~~~txt
modules/sports/
  infrastructure/
    providers/
      api-football/
        api-football-client.ts
        api-football-fixtures.provider.ts
        api-football-standings.provider.ts
        api-football-teams.provider.ts
~~~

### Reglas para API-Football

1. Todo acceso pasa por adaptadores dedicados.
2. Toda consulta cacheable pasa primero por Redis.
3. Toda respuesta externa debe mapearse a modelos internos.
4. No se debe propagar el formato crudo de la API al resto del sistema.
5. Los errores de red, límite, timeout o formato deben traducirse a errores internos claros.

---

## Patrón obligatorio para consultas cacheadas

Toda consulta externa cacheable debe modelarse con una estrategia uniforme.

### Flujo estándar

~~~txt
Route -> Use Case -> Cache Contract -> Provider Externo -> Redis -> Respuesta
~~~

### Flujo detallado

~~~txt
1. Route valida entrada
2. Route llama Use Case
3. Use Case construye cache key
4. Use Case consulta servicio/repositorio de caché
5. Si hay caché válida, devuelve ese valor
6. Si no hay caché válida, llama provider externo
7. Provider externo consulta API-Football
8. Resultado se transforma al formato interno
9. Se guarda en Redis con TTL correspondiente
10. Se devuelve el resultado
~~~

### Regla de abstracción

El caso de uso no debe conocer detalles de Redis ni detalles HTTP de API-Football.

Debe depender de contratos como:

- `CacheService`
- `FixtureProvider`
- `StandingsProvider`
- `TeamProvider`
- `CacheTTLPolicy`

---

## Claves de Redis

Las claves deben seguir un formato consistente.

Patrón recomendado:

~~~txt
minuto90:{env}:{modulo}:{recurso}:{identificadores}
~~~

Ejemplos:

~~~txt
minuto90:prod:sports:fixtures:live
minuto90:prod:sports:standings:league_128:season_2024
minuto90:prod:sports:team:team_33
minuto90:prod:stats:player:player_4421
~~~

### Regla de construcción de claves

Las claves deben construirse mediante funciones dedicadas en archivos separados.

Ejemplo:

- `build-live-fixtures-cache-key.ts`
- `build-league-standings-cache-key.ts`
- `build-team-details-cache-key.ts`

No concatenar claves manualmente en múltiples lugares del código.

---

## Errores y traducción

Los agentes deben trabajar con errores tipados.

Ejemplos:

- `ResourceNotFoundError`
- `ExternalApiUnavailableError`
- `CacheReadError`
- `CacheWriteError`
- `RateLimitExceededError`
- `InvalidQueryError`

Luego, en presentation, esos errores deben traducirse a respuestas HTTP y mensajes en español.

Ejemplo:

- `ExternalApiUnavailableError` -> `503` -> `No se pudo obtener información del proveedor externo`
- `ResourceNotFoundError` -> `404` -> `No se encontraron datos para la consulta realizada`
- `RateLimitExceededError` -> `429` -> `Se excedió el límite permitido para esta consulta`

---

## Documentación

Toda funcionalidad importante debe quedar documentada.

La documentación debe explicar, como mínimo:

1. Qué hace el módulo.
2. Qué casos de uso contiene.
3. Qué fuentes externas consume.
4. Qué estrategia de caché aplica.
5. Qué TTL usa cada consulta o grupo de consultas.
6. Qué errores relevantes puede devolver.
7. Qué contratos expone.

### Regla de documentación

Si se agrega una nueva consulta a API-Football, debe documentarse:

- cuál es su clave de caché
- cuál es su TTL
- por qué usa ese TTL
- qué pasa cuando no hay caché
- qué error devuelve si falla la fuente externa

---

## Reglas para rutas HTTP

Las rutas Elysia deben ser delgadas.

Solo deben:

1. validar entrada
2. llamar un caso de uso
3. mapear la respuesta
4. traducir errores

No deben:

- consultar Redis
- llamar API-Football
- decidir TTLs
- contener reglas de negocio
- transformar respuestas complejas

---

## Reglas para casos de uso

Los casos de uso son el centro de la lógica de aplicación.

Deben:

- coordinar contratos
- aplicar reglas del caso
- consultar caché primero
- decidir cuándo refrescar datos
- devolver modelos internos claros

No deben:

- depender de Elysia
- conocer detalles crudos de HTTP
- importar directamente clientes Redis
- importar directamente clientes de API-Football

---

## Reglas para infraestructura

Infraestructura implementa contratos.

Incluye:

- cliente Redis
- cliente API-Football
- repositorios concretos
- proveedores externos
- persistencia

Infraestructura no define reglas de negocio. Solo implementa acceso técnico.

---

## Regla de consistencia

Si existe un patrón ya aprobado para una consulta cacheada, toda nueva consulta del mismo tipo debe seguir exactamente el mismo patrón.

No deben coexistir múltiples estilos para resolver el mismo problema.

La consistencia es parte de la calidad del sistema.

---

## Regla de precisión

Los agentes no deben suponer comportamiento que no esté definido.

Si falta definir:

- un TTL
- una política de invalidación
- una estrategia de mapeo
- una clasificación de módulo

entonces deben proponer una solución explícita y documentarla, no improvisarla silenciosamente.

---

## Regla final

Este proyecto debe priorizar:

- claridad
- precisión
- consistencia
- mantenibilidad
- separación de responsabilidades
- documentación suficiente
- caché obligatoria antes de consumo externo

La regla más importante de este sistema es la siguiente:

> Antes de consultar API-Football, primero se consulta Redis. Si el dato existe y su TTL sigue vigente, se devuelve Redis. Si el TTL venció o no existe dato, se consulta la API externa, se guarda en Redis con el TTL correspondiente y se devuelve ese valor actualizado.

Esa política no es opcional. Es parte central de la arquitectura del sistema.
