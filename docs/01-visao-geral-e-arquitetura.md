# 1. Visão geral e arquitetura

## O que a aplicação faz

Este projeto é uma API REST para um blog. Ela permite:

- criar usuário e fazer login;
- consultar e alterar o próprio perfil;
- alterar senha e excluir a própria conta;
- criar, listar, consultar, editar e excluir os próprios posts;
- listar e consultar posts publicados sem autenticação;
- enviar imagens autenticado e servi-las por URL pública.

Não há frontend neste repositório. O arquivo `rest-client/requests.http` funciona como cliente manual de teste e usa a extensão REST Client do VS Code (ou ferramenta compatível).

## Estilo arquitetural

A aplicação usa uma arquitetura modular, orientada a funcionalidades (feature modules), com camadas simples:

```text
HTTP request
    │
    ▼
Controller ── DTO/pipe/guard/interceptor
    │
    ▼
Service ── regras de negócio e decisões de segurança
    │
    ▼
Repository (TypeORM)
    │
    ▼
Entity ── tabela/relacionamento
```

### Responsabilidade de cada camada

- **Módulo**: registra controllers, services, entidades e dependências.
- **Controller**: define a URL, o verbo HTTP, lê body/params/request e chama o service. Não deveria conter acesso direto ao banco.
- **DTO**: descreve e valida a entrada externa. DTO não é a mesma coisa que entidade: o cliente não deve controlar todos os campos do banco.
- **Service**: concentra regras como e-mail único, comparação de senha e filtro por autor.
- **Entity**: mapeia a estrutura persistida pelo TypeORM.
- **Response DTO**: seleciona o que sai da API. Essa separação é especialmente importante para não devolver `User.password`.
- **Common**: reúne comportamentos reutilizáveis e transversais, como hashing e tratamento de erros.

## Composição do NestJS

`src/main.ts` cria a aplicação com `NestFactory.create(AppModule)`. O `AppModule` importa:

- `AuthModule`: login e estratégia JWT;
- `UserModule`: usuário e seu repositório;
- `PostModule`: posts e seu repositório;
- `UploadModule`: upload e arquivos estáticos;
- `ConfigModule.forRoot({ isGlobal: true })`: carrega variáveis de ambiente;
- `ThrottlerModule`: configuração do rate limiting;
- `TypeOrmModule.forRootAsync`: escolha entre SQLite e PostgreSQL.

O módulo também registra dois providers globais:

1. `AllExceptionsFilter` como `APP_FILTER`, aplicado a todas as exceções HTTP;
2. `ThrottlerGuard` como `APP_GUARD`, aplicado globalmente às rotas.

Importante: `JwtAuthGuard` **não** é global. Cada endpoint protegido precisa declarar `@UseGuards(JwtAuthGuard)` explicitamente.

## Fluxo de uma requisição

Uma requisição passa, em linhas gerais, por:

1. Express/Nest recebe a conexão e roteia pelo método do controller.
2. Helmet adiciona headers de segurança.
3. CORS decide se o navegador pode ler a resposta.
4. O `ThrottlerGuard` verifica a janela de requisições.
5. Pipes transformam/validam a entrada; a `ValidationPipe` global rejeita campos extras.
6. Se a rota usar `JwtAuthGuard`, Passport extrai e valida o Bearer token.
7. O controller chama o service.
8. O service consulta ou altera o banco/arquivos.
9. Um response DTO controla o formato da resposta.
10. Em erro, `AllExceptionsFilter` padroniza o JSON.

## Por que existem DTOs de resposta

`UserResponseDto` retorna `id`, `name`, `email`, `createdAt` e `updatedAt`, mas não retorna `password` nem `forceLogout`. `PostResponseDto` retorna os dados do post e um resumo do autor (`id`, `name`, `email`). Essa escolha evita serializar a entidade inteira acidentalmente.

Há, porém, uma consequência de privacidade: o e-mail do autor é exposto também nas consultas públicas de posts. Veja a análise em [segurança](./06-upload-rede-e-seguranca.md#privacidade-e-exposicao-de-dados).

## Decisões arquiteturais observáveis

### SQLite e PostgreSQL

O código permite desenvolvimento local simples com `better-sqlite3` e deixa PostgreSQL como opção para um ambiente mais próximo de produção. A decisão reduz o atrito inicial, mas exige cuidado para que os dois bancos não diverjam em tipos, constraints e comportamento de migrations.

### Interface abstrata para hashing

`HashingService` é uma classe abstrata com `hash` e `compare`. `CommonModule` injeta `BcryptHashingService` como implementação. Assim, regras de usuário/autenticação dependem de uma abstração, e não diretamente de `bcryptjs`; trocar o algoritmo fica mais localizado.

### Autorização por posse

Os endpoints privados de post usam o usuário extraído do token para consultar `author.id`. Isso implementa uma forma simples de autorização: o usuário só deve ver ou alterar seus próprios recursos.

### Erros uniformes

O filtro global transforma erros em um contrato único:

```json
{
  "message": ["Mensagem principal"],
  "error": "Bad Request",
  "statusCode": 400
}
```

Erros de validação podem ter várias mensagens no array. Erros não reconhecidos como `HttpException` viram status 500 e mensagem genérica.
