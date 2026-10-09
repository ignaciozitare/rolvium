// Prueba del comprobador de capas. Uso: node scripts/boundaries.test.mjs (sale con 1 si algo falla)
import { extractImports, layerOf, violation } from './boundaries.mjs';

let failures = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${ok ? '' : `  → ${JSON.stringify(got)} (esperado ${JSON.stringify(want)})`}`);
};
const v = (file, spec) => { const l = layerOf(file); return l ? violation(file, l, spec) : 'SIN CAPA'; };
const W = 'apps/web/src/modules/hotdesk';
const A = 'apps/api/src';

eq('import type no cuenta; comentario no cuenta; import() sí', extractImports(
  "import type { A } from '../infra/x';\nimport { B } from '../infra/y';\n// import { C } from '../infra/z';\nconst d = await import('../infra/w');\nexport * from './k';\nexport type { T } from '../infra/t';",
).map((i) => `${i.spec}:${i.line}`), ['../infra/y:2', '../infra/w:4', './k:5']);

eq('web: dominio → infra', v(`${W}/domain/Seat.ts`, '../infra/SupabaseSeatRepo'), 'domain importa de infra');
eq('web: dominio → ui', v(`${W}/domain/Seat.ts`, '../ui/SeatCard'), 'domain importa de ui');
eq('web: dominio → react', v(`${W}/domain/Seat.ts`, 'react'), 'domain importa el paquete react');
eq('web: dominio → container', v(`${W}/domain/Seat.ts`, '../container'), 'domain importa de container');
eq('web: dominio → otro fichero de dominio: bien', v(`${W}/domain/entities/Seat.ts`, '../ports/SeatRepository'), null);
eq('web: aplicación → infra', v(`${W}/application/BookSeat.ts`, '../infra/Repo'), 'application importa de infra');
eq('web: aplicación → dominio: bien', v(`${W}/application/BookSeat.ts`, '../domain/Seat'), null);
eq('web: pantalla → infra', v(`${W}/ui/SeatView.tsx`, '../infra/Repo'), 'ui importa de infra');
eq('web: pantalla → @/shared/infra', v(`${W}/ui/SeatView.tsx`, '@/shared/infra/SupabaseAdminUserRepo'), 'ui importa de infra');
eq('web: pantalla → container: bien', v(`${W}/ui/SeatView.tsx`, '../container'), null);
eq('web: pantalla → react: bien', v(`${W}/ui/SeatView.tsx`, 'react'), null);
eq('web: shared/domain → supabase', v('apps/web/src/shared/domain/x.ts', '@supabase/supabase-js'), 'domain importa el paquete @supabase/supabase-js');
eq('api: dominio → infrastructure', v(`${A}/domain/jira/Port.ts`, '../../infrastructure/jira/Adapter.js'), 'domain importa de infrastructure');
eq('api: dominio → fastify', v(`${A}/domain/jira/Port.ts`, 'fastify'), 'domain importa el paquete fastify');
eq('api: aplicación → infrastructure', v(`${A}/application/x/UseCase.ts`, '../../infrastructure/supabase/Repo.js'), 'application importa de infrastructure');
eq('api: aplicación → dominio: bien', v(`${A}/application/x/UseCase.ts`, '../../domain/x/Port.js'), null);
eq('api: infraestructura no se vigila (puede importar de todo)', v(`${A}/infrastructure/http/routes.ts`, 'fastify'), 'SIN CAPA');
eq('OIH no es de este comprobador', v('packages/oih-domain/src/fact.ts', 'react'), 'SIN CAPA');

console.log(failures ? `\n${failures} FALLO(S)` : '\nTodo en verde');
process.exit(failures ? 1 : 0);
