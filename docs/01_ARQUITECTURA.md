# 01 · Arquitectura

[← Índice](README.md)

## 1. Vista general

El sistema tiene tres piezas: un **frontend React** que solo habla GraphQL, un **backend Apollo Server** organizado como monolito modular con los lados de escritura y lectura separados, y una base de datos **PostgreSQL en Supabase** con tablas distintas para el *write model* y el *read model*.

```mermaid
flowchart LR
  subgraph Cliente["🖥️ Frontend · React + Vite"]
    UI["Páginas<br/>Catálogo · Ficha · Carrito<br/>Seguimiento · Farmacia"]
    AC["Apollo Client<br/>ApolloProvider (raíz)<br/>InMemoryCache normalizada"]
    UI -- "useQuery / useMutation<br/>useSubscription" --> AC
  end

  AC -- "HTTP POST /graphql<br/>(queries y mutations)" --> AS
  AC <-. "WebSocket /graphql<br/>(subscriptions · graphql-ws)" .-> AS

  subgraph Servidor["⚙️ Backend · Apollo Server"]
    AS["Schema SDL + Resolvers"]
    subgraph Write["Lado de ESCRITURA"]
      CMD["Command Handlers<br/>invariantes + transacción"]
    end
    subgraph Read["Lado de LECTURA"]
      QRY["Query services"]
      DL["DataLoaders<br/>(1 juego por request)"]
    end
    PROJ["Projector + Políticas<br/>(asíncrono)"]
    PS["PubSub"]
    AS -- Mutation --> CMD
    AS -- Query --> QRY
    AS -- "campos anidados" --> DL
    PROJ --> PS -- "Subscription" --> AS
  end

  subgraph DB["🗄️ Supabase · PostgreSQL"]
    WM[("WRITE MODEL<br/>inventory · carts · orders<br/>order_items · prescriptions")]
    OB[("OUTBOX<br/>domain_events")]
    RM[("READ MODEL<br/>medication_catalog<br/>order_projections")]
    REF[("Referencia<br/>categories · laboratories")]
  end

  CMD -- "COMMIT atómico" --> WM
  CMD -- "misma transacción" --> OB
  OB -- "eventos pendientes" --> PROJ
  PROJ -- "actualiza" --> RM
  QRY --> RM
  DL -- "WHERE id = ANY($1)" --> RM
  DL --> REF
```

**Cómo leer el diagrama**

- Una **Mutation** nunca toca el read model: entra por un *Command Handler*, que valida invariantes y confirma en una sola transacción el nuevo estado **y** los eventos de dominio (outbox).
- Una **Query** nunca toca el write model: lee proyecciones desnormalizadas. Las relaciones anidadas (`category`, `laboratory`, `medication`) se resuelven en lote con **DataLoader**.
- El **Projector** consume el outbox de forma asíncrona, actualiza las proyecciones y publica el resultado en **PubSub**, que alimenta las **Subscriptions**.

---

## 2. Flujo de un pedido (consistencia eventual)

```mermaid
sequenceDiagram
  autonumber
  actor P as Paciente (React)
  participant A as Apollo Server
  participant C as placeOrder (comando)
  participant W as Write model + Outbox
  participant J as Projector
  participant R as Read model

  P->>A: mutation placeOrder(input)
  A->>C: ejecutar comando
  C->>W: BEGIN · SELECT … FOR UPDATE (inventario)
  C->>C: invariantes: fórmula médica · stock suficiente
  C->>W: descuenta stock · crea orden PENDING_APPROVAL · OrderPlaced + InventoryReserved
  C->>W: COMMIT
  A-->>P: PlaceOrderPayload { receipt } (acuse del comando)
  Note over P: UI: "Pedido recibido · preparando resumen…"<br/>order(id) todavía es null
  J->>W: lee eventos pendientes (tras PROJECTION_DELAY_MS)
  J->>R: inserta order_projections · refresca medication_catalog
  J-->>P: Subscription orderStatusChanged (PENDING_APPROVAL)
  Note over J: Política: si es venta libre → AutoApproveOtcOrder
  J-->>P: Subscription orderStatusChanged (APPROVED)
```

El detalle de cada paso está en [04 · CQRS](04_CQRS.md).

---

## 3. Despliegue

```mermaid
flowchart LR
  B["🌐 Navegador"]
  subgraph Vercel
    FE["SPA React<br/>(archivos estáticos)"]
  end
  subgraph Render["Render · Web Service"]
    BE["Node.js · Apollo Server<br/>HTTP + WebSocket en /graphql"]
  end
  subgraph Supabase
    PG[("PostgreSQL<br/>Session pooler :5432")]
  end

  B -- "descarga la app" --> FE
  B -- "HTTPS /graphql" --> BE
  B <-. "WSS /graphql" .-> BE
  BE -- "pg · SSL" --> PG
```

| Pieza | Plataforma | Por qué |
|---|---|---|
| Frontend | **Vercel** | Sirve la SPA como archivos estáticos con redeploy automático desde GitHub. |
| Backend | **Render** (Web Service) | Es un proceso Node **persistente**, así que mantiene conexiones **WebSocket**: las GraphQL Subscriptions funcionan en producción. |
| Base de datos | **Supabase** | PostgreSQL administrado exigido por el taller. El backend usa el *Session pooler* (IPv4), adecuado para un servidor persistente. |

> El backend también incluye un adaptador serverless ([`vercel-handler.ts`](../backend/src/vercel-handler.ts)) para correr en Vercel. En ese modo no hay WebSocket y el frontend cambia a *polling* con una sola variable (`VITE_ENABLE_SUBSCRIPTIONS=false`). Se conserva como alternativa, pero producción usa Render.

---

## 4. Organización del backend (monolito modular)

Cada carpeta tiene una sola responsabilidad y pertenece a un lado de CQRS:

| Carpeta | Responsabilidad | Lado |
|---|---|---|
| [`src/domain/`](../backend/src/domain) | Reglas puras: máquina de estados, validación de la fórmula, errores y eventos de dominio. Sin acceso a BD. | Dominio |
| [`src/commands/`](../backend/src/commands) | *Command Handlers*: validan entrada (Zod), abren transacción, verifican invariantes, persisten y escriben en el outbox. | **Escritura** |
| [`src/projections/`](../backend/src/projections) | Projector, handlers de proyección y políticas (aprobación automática OTC). | Escritura → Lectura |
| [`src/queries/`](../backend/src/queries) | Consultas SQL de solo lectura sobre las proyecciones. | **Lectura** |
| [`src/dataloaders/`](../backend/src/dataloaders) | Un juego de DataLoaders por request (anti N+1). | **Lectura** |
| [`src/graphql/`](../backend/src/graphql) | Schema, scalars, resolvers (delgados: delegan en comandos o consultas), contexto y plugin de logs. | Contrato |
| [`src/infra/`](../backend/src/infra) | Pool de PostgreSQL con métricas por request, logger, PubSub, tareas en segundo plano. | Infraestructura |
| [`src/http/app.ts`](../backend/src/http/app.ts) | Express + Apollo. Monta **solo** `/graphql`. | Transporte |

**¿Por qué monolito modular y no federación?** Hay un solo equipo y un solo contexto de negocio (catálogo + pedidos). Separar en *subgraphs* con Apollo Router añadiría un salto de red y coordinación de despliegues sin un beneficio real a esta escala. La separación en carpetas por responsabilidad permite extraer un subgraph más adelante si hiciera falta.

---

## 5. Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript en backend y frontend |
| Backend | Node.js + **Apollo Server 5** sobre Express |
| Subscriptions | `graphql-ws` + `ws` en el mismo endpoint `/graphql` |
| Resolución en lote | **DataLoader** (instancias nuevas por request) |
| Validación de comandos | Zod |
| Base de datos | **PostgreSQL en Supabase** (driver `pg`, transacciones reales) |
| Frontend | **React 19 + Vite** + React Router, Tailwind CSS 4 |
| Cliente GraphQL | **Apollo Client 4** + GraphQL Code Generator (operaciones tipadas) |
| Pruebas | Vitest (dominio) + prueba de humo de extremo a extremo (`npm run smoke`) |
