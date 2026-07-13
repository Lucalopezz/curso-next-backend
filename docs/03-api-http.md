# 3. API HTTP

## Convenções

- Base local usada no arquivo de requests: `http://localhost:3001`.
- O token é enviado como `Authorization: Bearer <accessToken>`.
- Bodies JSON exigem `Content-Type: application/json`.
- IDs de usuário e post são UUIDs.
- Erros seguem o formato do filtro global descrito na seção de arquitetura.
- Os endpoints `/post` sem `me` são públicos, mas retornam somente posts com `published=true`.

## Autenticação

### `POST /auth/login`

Body:

```json
{
  "email": "lucas@email.com",
  "password": "123456"
}
```

Resposta de sucesso:

```json
{
  "accessToken": "<jwt>"
}
```

Retorna `401` tanto quando o e-mail não existe quanto quando a senha está errada, usando a mesma mensagem para reduzir enumeração de usuários.

## Usuários

| Método | Rota | Auth | Entrada | Resultado |
|---|---|---:|---|---|
| `POST` | `/user` | não | `name`, `email`, `password` | usuário criado sem senha |
| `GET` | `/user/me` | sim | — | usuário do token |
| `PATCH` | `/user/me` | sim | `name` e/ou `email` | usuário atualizado |
| `PATCH` | `/user/me/password` | sim | `currentPassword`, `newPassword` | usuário atualizado |
| `DELETE` | `/user/me` | sim | — | usuário que foi excluído |

Validações relevantes:

- nome, senha e campos textuais precisam ser strings não vazias;
- e-mail precisa passar por `IsEmail`;
- senha nova precisa ter pelo menos 6 caracteres;
- a atualização de usuário não aceita senha: o DTO usa `OmitType`;
- uma atualização sem nome nem e-mail retorna `400`.

O cadastro verifica e-mail existente antes de salvar e a entidade também possui `unique: true`; a constraint do banco continua sendo a proteção final contra concorrência.

## Posts privados do usuário

Todas as rotas abaixo exigem JWT:

| Método | Rota | Entrada | Regra |
|---|---|---|---|
| `POST` | `/post/me` | `title`, `excerpt`, `content`, `coverImageUrl?` | cria post do usuário autenticado |
| `GET` | `/post/me` | — | lista apenas os posts do usuário, mais recentes primeiro |
| `GET` | `/post/me/:id` | UUID no path | consulta apenas o post do usuário |
| `PATCH` | `/post/me/:id` | campos parciais + `published?` | altera apenas o post do usuário |
| `DELETE` | `/post/me/:id` | UUID no path | remove o post do usuário |

Criação:

- título: string entre 10 e 150 caracteres;
- excerto: string entre 10 e 200 caracteres;
- conteúdo: string não vazia;
- imagem de capa: URL opcional; `require_tld: false` permite URLs de desenvolvimento como `http://localhost`;
- `published` não é aceito na criação e começa como `false`.

Atualização:

- `PartialType` torna os campos de criação opcionais;
- `published` é aceito somente como boolean;
- não é permitido enviar campos extras por causa de `forbidNonWhitelisted`;
- o slug não é recalculado quando o título muda.

## Posts públicos

| Método | Rota | Resultado |
|---|---|---|
| `GET` | `/post` | posts publicados, ordenados por `createdAt DESC` |
| `GET` | `/post/:slug` | um post publicado com aquele slug |

O service inclui a relação `author`. O response público contém `author.id`, `author.name` e `author.email`.

## Upload

### `POST /upload`

Exige JWT e recebe `multipart/form-data` com um campo chamado `file`:

```text
Content-Disposition: form-data; name="file"; filename="imagem.png"
Content-Type: image/png

<bytes da imagem>
```

Sucesso:

```json
{
  "url": "/uploads/2026-07-13/1752450000000-abc123.png"
}
```

O nome retornado é um exemplo: a data vem de `new Date().toISOString()` e, portanto, usa a data UTC. A extensão vem da assinatura binária detectada pelo pacote `file-type`, não do nome enviado pelo cliente.

### `GET /uploads/<data>/<arquivo>`

O `ServeStaticModule` publica o diretório `uploads` em `/uploads`. Não há endpoint de exclusão de arquivos. `fallthrough: false` faz o servidor parar com erro quando o arquivo não é encontrado; `index: false` impede servir automaticamente um `index.html`.

## Status e erros comuns

| Status | Causa típica |
|---:|---|
| `400` | DTO inválido, campo extra, arquivo ausente/inválido ou operação sem dados |
| `401` | token ausente/inválido/expirado, usuário inexistente, senha errada ou `forceLogout` ativo |
| `404` | usuário/post não encontrado |
| `409` | e-mail já existente |
| `429` | limite do throttler excedido |
| `500` | falha inesperada; mensagem genérica ao cliente |
