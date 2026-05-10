# Engineering Tool — MATLAB Toolbox

MATLAB-side client for the [Engineering Project Development Tool](https://github.com/chriertcafdle-beep/ToolDevelopment).
Lets engineers push workspace variables and Simulink Data Dictionary
contents into the project's parameter store, and pull the latest
parameter set back into MATLAB without leaving the IDE.

## Why a separate package

Aerospace customers live inside MATLAB / Simulink. A "save and upload"
file round-trip is too slow and breaks across `.sldd` versions. Driving
the tool's REST + MCP API from inside the running MATLAB session keeps
every value in sync, owns the version-correct `Simulink.data.dictionary`
API at install time, and avoids carrying per-MATLAB-release parsers on
the server. The toolbox is delivered through the MATLAB File Exchange on
its own SemVer cadence, separate from the web app's release cycle, and
lives at the repo root so contributors clone everything in one shot.

A future move to a real `git submodule` (and a separate
`engineering-tool-matlab` remote repo) is a one-liner once we register
the toolbox on the File Exchange — until then keeping it in-tree
removes the round-trip overhead.

## Install

In MATLAB:

```matlab
addpath(genpath('matlab-toolbox'))    % from the main repo's root
savepath
```

## Quick start

```matlab
% Configure once per session
client = ptool.ParameterToolClient( ...
    'https://app.example.com/api/v1', ...     % API base URL
    'YOUR_BYOK_OR_SESSION_TOKEN', ...         % see README §"Auth"
    'PROJECT-UUID');

% Push every numeric / struct workspace variable as a parameter
ptool.push(client);

% Pull the latest parameter set into the workspace
ws = ptool.pull(client);

% Three-way sync (remote + local + last-baseline)
report = ptool.sync(client);

% .sldd round-trip
ptool.pushFromSldd(client, 'myDict.sldd');
ptool.pullToSldd(client,  'myDict.sldd');
```

Each call carries provenance: `source = 'matlab'`, `hostname`, MATLAB
version, timestamp, and the SHA-256 of the `.m` script if one is loaded.

## Auth

Three options in priority order:

1. **OAuth device flow** (preferred): `ptool.login()` opens a browser
   to the project's auth page; the resulting JWT is cached under
   `prefdir`.
2. **MCP API key**: pass the key string when constructing the client.
3. **Project session JWT** (short-lived): copy from the web app's
   Settings → AI Access page.

## Supported MATLAB releases

- R2022a → R2024b (one packaged release per MATLAB major).
- Simulink Data Dictionary bridge requires MATLAB ≥ R2022a.

## Non-goals

- No offline cache. Network to the main backend is required.
  Air-gapped customers should use ReqIF / JSON export from the web app.
- No server-side `.sldd` parser. Cross-version Simulink dictionary
  format is a graveyard; the toolbox's in-MATLAB approach is the only
  one that stays correct as MATLAB evolves.

## Layout

```
matlab-toolbox/
├── +ptool/                     <- MATLAB package (use `ptool.foo()`)
│   ├── ParameterToolClient.m   <- typed REST client class
│   ├── push.m                  <- workspace -> server
│   ├── pull.m                  <- server -> workspace
│   ├── sync.m                  <- three-way merge
│   ├── pushFromSldd.m          <- .sldd -> server
│   ├── pullToSldd.m            <- server -> .sldd
│   ├── login.m                 <- OAuth device flow stub
│   ├── classToDataType.m       <- helper
│   ├── valueToString.m         <- helper
│   └── stringToValue.m         <- helper
├── tests/                      <- MATLAB unit tests (matlab.unittest)
└── docs/
    └── integration-with-backend.md
```

## Development

```bash
# Run the MATLAB unit tests (requires a MATLAB install)
matlab -batch "results = runtests('tests'); assertSuccess(results)"
```

## Release

The toolbox ships through the MATLAB File Exchange. Release flow:

1. Tag `vX.Y.Z` on the main repo at the same time as the backend release.
2. CI packages a `.mltbx` per supported MATLAB major release.
3. Submit to File Exchange via the maintainer's account.

SemVer follows the same major-bump rules as the main app's REST API:
breaking REST changes bump the toolbox major version too.

## License

MIT — same license as the parent repo.
