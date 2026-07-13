# 7. Testes, diagnóstico e evolução

## O que existe hoje

Há um único teste e2e em `test/app.e2e-spec.ts`. Ele cria um `TestingModule` com `AppModule`, inicializa a aplicação e espera:

```text
GET / → 200 → "Hello World!"
```

O código atual não possui `AppController` nem uma rota `/`, então esse teste parece ser o teste inicial do template NestJS e está desatualizado em relação ao backend atual. Além disso, nesta cópia não há `node_modules`, portanto o comando não chegou a executar o Jest.

## Como validar depois de instalar dependências

```bash
npm install
npm run build
npm test -- --runInBand
npm run test:e2e
npm run lint
```

Antes do e2e, configure um ambiente de teste isolado. Se usar SQLite com `synchronize=1`, use um arquivo temporário e remova-o ao final; não aponte testes para o banco de desenvolvimento.

## Testes prioritários

### Autenticação

- login correto devolve JWT;
- e-mail inexistente e senha errada devolvem a mesma resposta `401`;
- token expirado, adulterado e ausente são rejeitados;
- usuário com `forceLogout=true` não acessa rota protegida;
- alterar senha invalida a sessão conforme a política escolhida;
- um novo login não deve revalidar tokens antigos depois da correção.

### Autorização/IDOR

Criar dois usuários e dois posts. Verificar que o usuário A não consegue:

- `GET`, `PATCH` ou `DELETE` do post de B;
- obter dados do post de B pela resposta de exclusão;
- listar post de B pela rota `/post/me`.

Esse conjunto deve capturar especificamente o problema de `PostService.remove`.

### DTOs

- campos extras são rejeitados;
- tipos incorretos falham;
- título/excerto fora dos limites falham;
- senha de cadastro e senha de alteração seguem a mesma regra;
- UUID inválido falha no `ParseUUIDPipe`.

### Upload

- campo `file` ausente;
- MIME não-imagem;
- arquivo com MIME de imagem, mas conteúdo não-imagem;
- PNG/JPEG/WebP/GIF válidos;
- arquivo acima de 900 KB;
- vários uploads e comportamento sob limite de memória;
- arquivo salvo com extensão detectada e URL acessível.

### Dados

- e-mail duplicado retorna `409`;
- concorrência no cadastro continua protegida pelo unique do banco;
- excluir usuário remove posts conforme cascade;
- posts públicos nunca retornam `published=false`;
- mudar título preserva ou altera slug de acordo com a decisão desejada.

## Melhorias de produção em ordem sugerida

1. Corrigir a autorização em `PostService.remove` e adicionar teste de IDOR.
2. Substituir `forceLogout` por versão de sessão ou revogação real de tokens.
3. Definir `limits.fileSize` no Multer e limites de proxy.
4. Adicionar migrations e desligar `synchronize` fora do desenvolvimento.
5. Validar variáveis de ambiente no startup, especialmente secret, banco e portas.
6. Uniformizar política de senha e normalização de e-mail.
7. Separar response DTO público do DTO autenticado para não expor e-mail sem intenção.
8. Adicionar paginação, índices e limites de consulta.
9. Trocar filesystem local por storage apropriado quando houver múltiplas instâncias.
10. Criar testes unitários de services e testes e2e do fluxo completo.
11. Adicionar logs estruturados, métricas, health check e rastreamento de request.
12. Atualizar/remover o teste legado de `GET /`.

## Exercícios para revisar o projeto

1. Desenhe a sequência de `POST /auth/login` e marque onde ocorre autenticação, autorização e persistência.
2. Explique por que CORS não impede um script server-to-server de chamar a API.
3. Compare `findOneOwnedOrFail` com `findOneOrFail` e localize a diferença de segurança.
4. Descreva o que aconteceria se `DB_SYNCHRONIZE=1` fosse usado em produção.
5. Implemente mentalmente um token com `sessionVersion` e explique quando ele é invalidado.
6. Calcule o custo de aceitar uploads ilimitados em `memoryStorage`.
7. Decida se o autor público deve ter e-mail, e crie um DTO que represente essa decisão.
8. Especifique um teste que prove que um post privado nunca aparece em `/post`.
