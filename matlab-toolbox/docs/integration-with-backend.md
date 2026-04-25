# Backend integration contract

The toolbox depends on these REST endpoints from the main backend:

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/v1/parameters/:projectId?page=&pageSize=&q=&status=` | List + search |
| `GET`  | `/api/v1/parameters/:projectId/:id` | Fetch one |
| `POST` | `/api/v1/parameters/:projectId` | Create (with `source=matlab`) |
| `PUT`  | `/api/v1/parameters/:projectId/:id` | Update |
| `GET`  | `/api/v1/parameters/:projectId/facets` | Distinct values for filters |

Auth: `Authorization: Bearer <jwt-or-mcp-key>`. The backend's
`authenticateToken` middleware accepts both forms.

## Provenance fields the backend honours on POST

The toolbox sets these on every created parameter so audit trails know
where the value came from:

```json
{
  "name": "v_bus",
  "dataType": "float",
  "defaultValue": "28.0",
  "source": "matlab",
  "matlabVersion": "R2024b",
  "hostname": "alice-laptop"
}
```

## Versioning policy

The toolbox treats the backend's REST surface as a contract. Breaking
changes in the backend (renamed fields, removed endpoints) bump the
toolbox's major version. Use the toolbox's `vX.*` line that matches the
backend's `/v<N>/` prefix.

## Future work

- Wire `/api/v1/oauth/device` for a real device-flow login (replaces
  the paste-token shim in `+ptool/login.m`).
- Add `/api/v1/parameters/:id/versions` consumption so `sync()` can
  diff against any prior version, not just the last in-session pull.
