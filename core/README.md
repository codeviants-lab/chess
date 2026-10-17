# core/

Uygulamanın değişmez çekirdeği: olaylar, hash zinciri, depolama arayüzü, projeksiyonlar, puan ve turnuva
eklentileri. Bkz. SPEC.md.

## Kurallar

- **Bağımsızlık:** `core/` içindeki dosyalar yalnızca `core/` içinden ve izin verilen paketlerden (`chess.js`)
  import eder. `app/`'e, Supabase'e, tarayıcıya (`window`, `document`, `localStorage`) ya da Node'a (`node:*`)
  bağımlılık yoktur.
- Bu kural iki yerde makinece denetlenir:
  - `tsconfig.core.json` çekirdeği DOM ve Node tipleri olmadan derler; tarayıcı ya da Node API'si kullanan
    kod `npm run typecheck`'te hata verir.
  - `tests/core-boundaries.test.ts` çekirdekteki her import'u tarar; `core/` dışına ya da izin listesinde
    olmayan bir pakete giden import testte hata verir.
- Yeni bir paketin çekirdekte kullanılması gerekiyorsa önce Issue'da sorulur, sonra izin listesine eklenir.
