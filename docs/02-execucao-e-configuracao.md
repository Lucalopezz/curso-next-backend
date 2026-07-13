# 2. Execução e configuração

## Pré-requisitos

- Node.js compatível com as versões usadas no `package.json` (o projeto usa TypeScript 5.7, NestJS 11 e tipos Node 22 nos devDependencies);
- npm;
- para PostgreSQL, uma instância acessível e credenciais válidas;
- para SQLite, nenhum servidor externo é necessário.

## Instalação e comandos

```bash
npm install
npm run start:dev
```

Scripts disponíveis:

| Comando | Finalidade |
|---|---|
| `npm run build` | compila para `dist/` |
| `npm run start` | inicia sem watch |
| `npm run start:dev` | inicia em modo desenvolvimento e observa alterações |
| `npm run start:prod` | executa `node dist/main` |
| `npm run lint` | executa ESLint com `--fix` |
| `npm test` | testes unitários Jest |
| `npm run test:e2e` | testes e2e usando `test/jest-e2e.json` |
| `npm run test:cov` | cobertura |
| `npm run format` | Prettier em `src` e `test` |

O build do Nest apaga o diretório de saída anterior por causa de `deleteOutDir: true` em `nest-cli.json`.

## Variáveis de ambiente

`ConfigModule.forRoot` carrega o `.env` padrão, mas o código lê diretamente `process.env` em vários pontos. O arquivo de referência é `.env-exemple`; ele não contém `JWT_SECRET`, que é obrigatório para iniciar o módulo de autenticação.

| Variável | Uso | Padrão/comportamento |
|---|---|---|
| `PORT` | porta HTTP | `3000` |
| `CORS_WHITELIST` | origens autorizadas pelo CORS | vazio; aceita origens ausentes, mas rejeita origens de navegador não listadas |
| `JWT_SECRET` | assinar e verificar JWT | obrigatório; a aplicação lança erro se faltar |
| `JWT_EXPIRATION` | validade do JWT | `86400`, interpretado pelo `jsonwebtoken` em segundos |
| `DB_TYPE` | driver do banco | exatamente `better-sqlite3` ativa SQLite; qualquer outro valor segue o ramo PostgreSQL |
| `DB_DATABASE` | arquivo SQLite ou nome do banco PostgreSQL | SQLite: `./db.sqlite` se vazio |
| `DB_HOST` | host PostgreSQL | sem fallback no código |
| `DB_PORT` | porta PostgreSQL | `5432` |
| `DB_USERNAME` | usuário PostgreSQL | sem fallback |
| `DB_PASSWORD` | senha PostgreSQL | sem fallback |
| `DB_SYNCHRONIZE` | sincronização automática de schema | só `1` ativa |
| `DB_AUTO_LOAD_ENTITIES` | descoberta automática de entidades | só `1` ativa |

Exemplo mínimo para desenvolvimento:

```dotenv
PORT=3001
CORS_WHITELIST=http://localhost:3000 http://localhost:3001
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
JWT_EXPIRATION=86400
DB_TYPE=better-sqlite3
DB_DATABASE=./db.sqlite
DB_SYNCHRONIZE=1
DB_AUTO_LOAD_ENTITIES=1
```

O parser de CORS separa a lista por qualquer espaço e remove barras finais. Logo, `http://localhost:3000/` e `http://localhost:3000` tornam-se a mesma entrada.

## Banco de dados

Quando `DB_TYPE=better-sqlite3`, o TypeORM recebe:

```ts
{
  type: 'better-sqlite3',
  database,
  synchronize,
  autoLoadEntities,
}
```

Em qualquer outro caso, recebe configuração PostgreSQL com host, porta, usuário, senha e database.

### `synchronize`

`DB_SYNCHRONIZE=1` permite que o TypeORM ajuste o schema automaticamente conforme as entidades. É conveniente durante a aprendizagem, mas perigoso em produção porque alterações de entidades podem alterar ou remover estruturas sem o controle explícito de uma migration. O próprio `.env-exemple` recomenda `0` em produção.

### Migrations

Não há diretório nem scripts de migration no projeto. Portanto, a documentação de produção deve incluir uma estratégia antes de usar PostgreSQL com dados importantes: gerar migrations versionadas, aplicá-las no deploy e deixar `synchronize` desativado.

## Configuração de compilação

`tsconfig.json` usa:

- módulo/resolução `nodenext`;
- alvo `ES2023`;
- decorators e metadata, necessários pelos decorators do NestJS e TypeORM;
- `strictNullChecks: true`;
- source maps;
- `noImplicitAny: false` e outras flexibilizações.

O `tsconfig.build.json` exclui testes, `node_modules`, `dist` e arquivos `*.spec.ts`.

## Arquivos gerados e ignorados

`.gitignore` exclui `dist`, `node_modules`, `coverage`, `.env`, `db.sqlite` e `uploads`. Isso protege segredos e dados locais de não serem commitados, mas implica que cada ambiente precisa criar sua própria configuração e diretório de runtime.
