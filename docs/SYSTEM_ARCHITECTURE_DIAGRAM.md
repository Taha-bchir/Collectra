# System Architecture Diagram (High-Level Overview)

```mermaid
flowchart LR
    U["User<br/>Browser"]
    FE["Next.js Frontend<br/>Dashboard + Auth Pages"]
    API["Hono API<br/>Routes + Middleware<br/>Auth + Tenant"]
    SB["Supabase<br/>Auth + Postgres"]
    PR["Prisma ORM"]

    U -->|UI interactions| FE
    FE -->|API calls| API
    API -->|Auth flow| SB
    API -->|DB queries via ORM| PR
    PR -->|SQL queries| SB
    API -->|API responses| FE
    FE -->|Rendered pages| U
```

## Notes

- `User (browser)` interacts with the Next.js application.
- `Next.js Frontend` sends authenticated API requests to Hono.
- `Hono API` enforces middleware (`auth` and `tenant`) before route handlers.
- `Supabase` handles authentication and hosts PostgreSQL.
- `Prisma ORM` is used by the API for database access
