---

name: minuto90-backend
description: Standards for building and maintaining a robust Elysia + Bun backend with clean architecture, SOLID principles, strict file responsibility, Redis abstractions, and production-grade engineering practices.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# minuto90-backend

This skill defines the architectural and implementation standards for a backend built with **Elysia + Bun**.

The objective is to keep the backend:

* maintainable
* modular
* testable
* scalable
* observable
* secure
* easy to evolve over time

This skill must favor **clarity over speed**, **structure over improvisation**, and **explicit boundaries over convenience shortcuts**.

## When to use

Use this skill when the task involves any of the following:

* creating or modifying an Elysia + Bun backend
* designing backend modules or domain boundaries
* implementing routes, use cases, repositories, workers, or infrastructure adapters
* integrating Redis, PostgreSQL, queues, sessions, rate limiting, caching, or background jobs
* refactoring code toward clean architecture
* reviewing backend structure, robustness, maintainability, or code quality
* enforcing file organization, naming conventions, and SOLID rules
* designing cross-cutting concerns such as logging, config, error handling, metrics, tracing, or security

## Architectural goal

The backend must be organized by **business module first**, and by **technical layer second**.

Do not organize the codebase primarily by framework pieces like `controllers`, `services`, `routes`, `repositories`, or `utils` at the root level.

The main unit of organization must be the **module** or **bounded context**.

## Canonical project structure

Use this structure as the default target:

```txt
src/
  modules/
    notifications/
      domain/
      application/
      infrastructure/
      presentation/
    sports/
      football/
        domain/
        application/
        infrastructure/
        presentation/
      nba/
        domain/
        application/
        infrastructure/
        presentation/
      shared/
        domain/
        application/
        infrastructure/
    stats/
      domain/
      application/
      infrastructure/
      presentation/

  shared/
    domain/
    application/
    infrastructure/
    presentation/

  bootstrap/
  config/
  workers/
  server.ts
```

If a sub-area such as `football`, `nba`, `push`, or `whatsapp` is not a real module but only a technical variation, provider, or delivery channel, then it must not be promoted to top-level module status. In that case, keep it inside the relevant infrastructure or provider layer.

## Module design rule

Before creating folders, determine what the thing actually is.

Every area must be classified as one of these:

* a business module
* a submodule of a business module
* a technical adapter
* a shared cross-cutting component

Do not mix those concepts in the same level of the tree.

For example:

* `notifications` can be a business module
* `push` and `whatsapp` are usually delivery channels or infrastructure adapters
* `football` and `nba` may be modules only if they truly have distinct rules and workflows
* otherwise they should remain providers, strategies, or subdomains inside `sports`

## Clean architecture boundaries

Each module should respect these layers.

### Domain

The domain layer contains pure business concepts and rules.

Allowed:

* entities
* value objects
* domain services
* domain errors
* repository contracts
* business rules and invariants

Not allowed:

* Elysia
* Redis clients
* database clients
* HTTP request/response logic
* environment variable access
* external SDKs

### Application

The application layer contains use cases and orchestration.

Allowed:

* use cases
* application services when they coordinate use cases
* input/output DTOs
* command and query handlers
* transaction orchestration abstractions
* ports and contracts for infrastructure dependencies

Not allowed:

* inline SQL
* Redis client usage
* HTTP framework logic
* Elysia context
* transport-specific details

### Infrastructure

The infrastructure layer contains implementations of external dependencies.

Allowed:

* repository implementations
* Redis adapters
* PostgreSQL adapters
* queue producers/consumers
* external API clients
* token signers
* mailers
* loggers
* cache implementations

This layer may depend on domain and application. Domain and application must not depend on infrastructure.

### Presentation

The presentation layer contains transport-specific adapters.

Allowed:

* Elysia routes
* request parsing
* schema binding
* response mapping
* auth guards
* HTTP error translation

Presentation must call the application layer. It must not contain business logic.

## File responsibility rules

### One file, one primary responsibility

This is mandatory.

Each file should have one clear reason to change.

Examples:

```txt
create-user.use-case.ts
create-user.dto.ts
user.entity.ts
user.repository.ts
postgres-user.repository.ts
login.route.ts
login.schema.ts
auth-response.mapper.ts
build-session-cache-key.ts
```

Do not place helper functions inside unrelated files just because they are only used once.

If a function has a distinct responsibility, create a dedicated file for it.

Typical extractions that deserve their own file:

* mappers
* schema definitions
* cache key builders
* normalizers
* policy checks
* formatters
* repository queries
* token parsers
* permission evaluators

### Forbidden dumping grounds

Do not create or grow generic files such as:

* `utils.ts`
* `helpers.ts`
* `common.ts`
* `misc.ts`
* `service.ts` when it contains many unrelated behaviors
* `lib/` as a vague catch-all folder

If a `lib` directory already exists, it must be reduced or eliminated unless every file inside it has a narrow, explicit, and stable purpose.

## Naming conventions

Names must be explicit and role-based.

Prefer:

* `create-match.use-case.ts`
* `find-user-by-email.repository.ts`
* `redis-session.store.ts`
* `push-notification.sender.ts`
* `football-score.provider.ts`
* `login.schema.ts`
* `match-response.mapper.ts`

Avoid vague names such as:

* `service.ts`
* `manager.ts`
* `handler.ts` unless it is specifically a handler abstraction
* `functions.ts`
* `tool.ts`
* `util.ts`

## Folder conventions inside a module

Use a predictable structure inside each module.

Recommended pattern:

```txt
module-name/
  domain/
    entities/
    value-objects/
    errors/
    services/
    repositories/
  application/
    use-cases/
    contracts/
    dto/
    mappers/
  infrastructure/
    persistence/
    redis/
    providers/
    queue/
  presentation/
    http/
      routes/
      schemas/
      mappers/
```

Only create subfolders when they add clarity. Do not create empty architecture theater.

## DTO placement rule

DTOs must not float randomly at the module root.

Place DTOs in:

* `application/dto` when they belong to use case input/output boundaries
* `presentation/http/schemas` when they represent transport validation

Do not create root-level `dtos/` in one module while other modules follow a different pattern.

## SOLID rules

### Single Responsibility Principle

Every class, function, and file must have one primary responsibility.

A route defines routes.
A use case implements one use case.
A repository persists and retrieves data.
A mapper maps.
A validator validates.
A cache key builder only builds keys.

### Open/Closed Principle

Stable logic should be extendable without rewriting the core flow.

Use:

* interfaces
* strategies
* providers
* adapters
* composition

Avoid large `if/else` or `switch` chains for provider-specific behavior when a polymorphic solution is cleaner.

### Liskov Substitution Principle

Implementations of a contract must behave consistently.

For example:

* all `SessionStore` implementations must obey the same session semantics
* all `CacheService` implementations must respect TTL expectations
* all repository implementations must return equivalent domain concepts

### Interface Segregation Principle

Interfaces must stay small and specific.

Avoid oversized contracts such as:

```ts
interface NotificationService {
  sendPush(): Promise<void>
  sendWhatsapp(): Promise<void>
  saveNotification(): Promise<void>
  retryFailedNotifications(): Promise<void>
  cacheDeliveryStatus(): Promise<void>
}
```

Prefer narrow contracts such as:

* `NotificationRepository`
* `NotificationSender`
* `DeliveryStatusStore`
* `NotificationQueue`

### Dependency Inversion Principle

High-level code must depend on abstractions, not concrete framework or infrastructure code.

Use cases may depend on contracts like:

* `UserRepository`
* `SessionStore`
* `CacheService`
* `ScoreProvider`
* `NotificationSender`

Use cases must not import:

* Elysia context
* raw Redis clients
* Prisma or SQL code directly
* JWT library directly unless wrapped behind a contract

## Elysia rules

### Keep routes thin

An Elysia route should do only this:

* validate request input
* map it into the application input
* call a use case
* map the result into HTTP response format
* translate known errors into status codes

Routes must not:

* contain business rules
* access Redis directly
* access SQL directly
* contain cache invalidation logic
* perform complex transformation logic
* implement retries or external integration flows

### Use plugins for cross-cutting concerns only

Use Elysia plugins for concerns such as:

* auth context
* request id
* logging
* rate limiting
* tracing
* metrics
* shared error handling

Do not hide business use cases inside framework plugins.

### Validate at the edge

Validate request body, params, query, and headers in the presentation layer.

Validation at the HTTP edge does not replace domain invariants.

## Redis rules

Redis must always be used through explicit abstractions.

Never scatter raw Redis access across modules.

### Valid Redis use cases

Redis may be used for:

* caching
* sessions
* rate limiting
* distributed locks
* pub/sub
* streams
* idempotency keys
* queue support
* temporary tokens

### Redis abstraction rule

Create narrow contracts such as:

* `CacheService`
* `SessionStore`
* `RateLimitStore`
* `DistributedLockService`
* `IdempotencyStore`

Implement them in infrastructure.

Example:

```txt
shared/
  application/
    contracts/
      cache.service.ts
      session.store.ts
      rate-limit.store.ts
  infrastructure/
    redis/
      redis-cache.service.ts
      redis-session.store.ts
      redis-rate-limit.store.ts
```

### Redis key rule

All keys must follow a naming convention.

Pattern:

```txt
app:env:module:resource:identifier
```

Examples:

```txt
minuto90:prod:auth:session:user_123
minuto90:prod:notifications:delivery:job_456
minuto90:prod:sports:score:match_789
```

Cache key construction must be centralized in dedicated files.

### TTL rule

Every Redis write must have an intentional expiration policy or a documented reason not to expire.

Before storing anything, define:

* why it is stored
* how long it lives
* what invalidates it
* whether stale data is acceptable

### Cache strategy rule

Prefer one consistent caching strategy per use case.

For cache-aside flows:

* read cache first
* fall back to source of truth
* repopulate cache with TTL
* invalidate or refresh on writes when needed

Do not mix random caching approaches in the same domain without a reason.

### Locking rule

If using distributed locks:

* always set expiration
* use ownership tokens
* only release if token ownership matches
* avoid indefinite locks

### Rate limiting rule

Rate limiting must be centralized and reusable, not rewritten per route.

## Persistence rules

### Repository role

A repository implementation should:

* fetch and persist data
* translate raw database records into domain concepts
* hide persistence details from the application layer

A repository should not:

* make business decisions
* send notifications
* trigger unrelated side effects
* manage transport logic

### Query extraction

If a query becomes complex, extract it into a dedicated file or query object.

Do not let repository files become giant unreadable persistence scripts.

### Transaction boundary

Transaction orchestration belongs to the application layer through explicit abstractions.

Do not let routes or random repositories define business transaction flows implicitly.

## Shared vs module-specific code

Put code in `shared/` only when it is truly cross-cutting and reusable across modules.

Examples of valid shared code:

* base error abstractions
* shared cache contracts
* shared Redis implementations
* logger adapters
* config parsing
* HTTP middleware/plugins
* queue adapters

Do not move code to `shared/` too early. If the behavior belongs clearly to one module, keep it inside that module.

## Workers and background jobs

Use `workers/` for independent async processing flows.

A worker should:

* call application-layer use cases or orchestrators
* remain decoupled from HTTP concerns
* have clear input contracts
* produce structured logs
* handle retries intentionally

A worker must not contain hidden business logic that duplicates the main application flow.

## Error handling

### Use typed errors

Expected failures must use explicit error types.

Examples:

* `UserNotFoundError`
* `InvalidCredentialsError`
* `NotificationDeliveryError`
* `MatchNotFoundError`
* `RateLimitExceededError`
* `InvalidSessionError`

Do not throw generic `Error` for expected business outcomes.

### Translate errors at the edge

Map application and domain errors to HTTP responses in presentation.

Examples:

* not found -> `404`
* invalid input -> `400`
* invalid credentials -> `401`
* forbidden -> `403`
* conflict -> `409`
* rate limit exceeded -> `429`

Never leak infrastructure exceptions directly to clients.

## Configuration rules

### Centralize env parsing

Environment variables must be loaded and validated in a dedicated config layer.

Do not access `process.env` throughout the codebase.

Recommended:

```txt
config/
  env.ts
  app.config.ts
```

### Configuration must be typed

Expose configuration through stable typed objects, not raw strings.

## Logging and observability

### Structured logging only

Logs must be structured and contextual.

Include when relevant:

* request id
* route
* module
* user id if available
* latency
* job id
* retry count
* error code

### Operational visibility

A robust backend should support, as appropriate:

* health checks
* readiness checks
* metrics
* tracing hooks
* external dependency visibility
* queue monitoring
* retry visibility

## Testing rules

Test at the correct level.

* domain tests for business rules
* application tests for use cases
* integration tests for repositories and infrastructure adapters
* route/integration tests for HTTP contracts
* worker tests for async processing behavior

Mock abstractions, not framework internals, unless the goal is integration testing.

## Security rules

Apply secure defaults everywhere.

Include as needed:

* input validation
* authorization checks
* authentication boundaries
* rate limiting
* safe session/token handling
* secret isolation
* least privilege infrastructure access
* safe error exposure
* audit-aware logging for sensitive operations

Never log:

* passwords
* raw access tokens
* refresh tokens
* secrets
* API keys
* private keys
* sensitive personal data unless explicitly required and controlled

## Review rules for an existing codebase

When reviewing or refactoring an existing backend, apply these checks:

1. Is the root organization based on modules or is it mixed with technical folders?
2. Do all modules follow the same convention?
3. Are subdomains, providers, and adapters clearly differentiated?
4. Is there any `lib`, `utils`, `helpers`, or giant `service.ts` acting as a dumping ground?
5. Are DTOs placed consistently?
6. Is Redis abstracted behind contracts?
7. Are routes thin?
8. Is any business logic leaking into infrastructure or presentation?
9. Are names explicit?
10. Does each file have one reason to change?

## Expected refactor direction

When the codebase shows a hybrid structure, refactor toward these outcomes:

* unify naming and folder conventions across all modules
* remove generic catch-all folders
* move technical providers under infrastructure
* move DTOs under application or presentation
* add missing `domain` folders where business rules exist
* isolate Redis behind shared contracts and implementations
* split large files into use-case-specific files
* make routes thinner
* reduce architectural inconsistencies between modules

## Example: notifications module

Do not structure a module like this if channel types are mixed with architecture layers:

```txt
notifications/
  application/
  infrastructure/
  presentation/
  whatsapp/
```

Instead, choose one consistent model.

If channels are infrastructure adapters:

```txt
notifications/
  domain/
  application/
  infrastructure/
    channels/
      push/
      whatsapp/
  presentation/
```

## Example: sports module

If `football` and `nba` are truly distinct domains:

```txt
sports/
  football/
    domain/
    application/
    infrastructure/
    presentation/
  nba/
    domain/
    application/
    infrastructure/
    presentation/
```

If they are only data providers or variants of the same domain, keep them inside one sports module and separate them through contracts and adapters.

## Non-negotiable rules

* no business logic in routes
* no raw Redis usage in use cases
* no raw SQL or ORM usage in routes
* no `utils.ts`, `helpers.ts`, `misc.ts`, or similar dumping grounds
* no giant service files
* no vague naming
* no DTO folders floating inconsistently
* no framework leakage into domain
* no technical adapters placed as pseudo-modules without clear intent
* no hidden side effects in mappers or repositories
* no Redis writes without an explicit TTL policy or documented reason

## Implementation workflow

When building or refactoring backend functionality, follow this order:

1. identify the business module involved
2. determine whether subareas are real modules or only adapters/providers
3. define domain concepts and boundaries
4. define use case inputs/outputs
5. define required contracts
6. implement infrastructure adapters
7. implement thin presentation routes
8. add validation and error mapping
9. add tests at the correct layer
10. review naming, file granularity, and architectural consistency

## Final principle

A backend is not solid because it works today.
It is solid when new features can be added without collapsing boundaries, duplicating logic, or turning the codebase into a negotiation with chaos.

This skill must always optimize for that standard.
