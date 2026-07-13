# 5. Login e ciclo de autenticação

## Componentes

| Arquivo | Papel |
|---|---|
| `auth.controller.ts` | expõe `POST /auth/login` |
| `auth.service.ts` | procura usuário, compara senha e assina token |
| `jwt.strategy.ts` | configura Passport JWT e valida o usuário a cada request |
| `jwt-auth.guard.ts` | conecta Passport ao endpoint e padroniza rejeição |
| `jwt-payload.type.ts` | tipa `sub` e `email` presentes no payload |
| `authenticated-request.ts` | tipa `req.user` como `User` |

## Fluxo do login

```text
Cliente
  │ POST /auth/login {email, password}
  ▼
LoginDto + ValidationPipe
  ▼
UserService.findByEmail(email)
  ├── não encontrado ──► 401 "Usuário ou senha inválidos"
  ▼
HashingService.compare(password, user.password)
  ├── falso ───────────► 401 mesma mensagem
  ▼
JwtService.signAsync({ sub: user.id, email: user.email })
  ▼
user.forceLogout = false; salva usuário
  ▼
{ accessToken }
```

Usar a mesma mensagem nos dois casos de falha evita revelar diretamente se um e-mail está cadastrado.

## Estrutura do JWT

O payload criado pela aplicação contém:

```json
{
  "sub": "uuid-do-usuario",
  "email": "usuario@email.com"
}
```

O `sub` é a fonte de identidade usada para buscar o usuário. O `email` é redundante no fluxo atual: a estratégia usa `payload.sub` para buscar o registro e retorna a entidade inteira. O token também recebe `iat` e `exp` da biblioteca JWT.

O token é extraído exclusivamente do header `Authorization: Bearer ...`. Não há cookie de sessão nem refresh token implementado.

## Fluxo de uma rota protegida

1. `@UseGuards(JwtAuthGuard)` chama `AuthGuard('jwt')`.
2. `passport-jwt` extrai o Bearer token.
3. A assinatura é verificada com `process.env.JWT_SECRET`.
4. `ignoreExpiration: false` rejeita token expirado.
5. `JwtStrategy.validate(payload)` busca o usuário pelo `sub`.
6. Usuário inexistente ou com `forceLogout=true` gera `UnauthorizedException`.
7. O usuário retornado pela strategy é colocado em `req.user`.
8. O controller passa esse usuário para o service, que usa seu `id` para autorização de posse.

O guard ainda verifica `info instanceof JsonWebTokenError` e converte falhas para `401 "Você precisa fazer login"`.

## O que está protegido

- perfil `/user/me`;
- alterações e exclusão de usuário;
- criação, leitura privada, edição e exclusão de post;
- upload.

Cadastro de usuário e leitura pública de posts são deliberadamente anônimos.

## `forceLogout`: intenção e limitação

A intenção é invalidar tokens anteriores quando o e-mail ou senha muda:

```text
alterar senha/e-mail → forceLogout = true → strategy rejeita JWT
```

Mas o login seguinte faz `forceLogout=false`. Como os JWT antigos continuam criptograficamente válidos até expirar e não carregam uma versão de sessão, um token antigo pode voltar a funcionar depois de um novo login. Isso não implementa revogação robusta.

### Melhoria recomendada

Usar uma versão de sessão, por exemplo `tokenVersion` ou `sessionVersion`:

1. incluir a versão no JWT;
2. incrementar a versão ao trocar senha, e-mail ou fazer logout global;
3. validar `payload.version === user.tokenVersion` em toda requisição.

Outra opção é manter uma denylist de `jti`, mas ela exige armazenamento e limpeza. Em ambos os casos, o objetivo é que emitir um token novo não revalide tokens antigos.

## Armazenamento do token no cliente

O backend só define o contrato Bearer; este repositório não mostra como o frontend armazena o token. Em uma aplicação web, armazenar token em `localStorage` aumenta o impacto de XSS. Cookies `HttpOnly`, `Secure`, `SameSite` podem reduzir exposição a JavaScript, mas exigem desenho explícito de CSRF e domínio.

## Limites atuais de autorização

- Não há papéis/roles: todo usuário autenticado tem as mesmas capacidades.
- Não há autorização administrativa.
- A autorização de post é por proprietário, não por colaboração.
- A exclusão de post contém a falha descrita na seção de dados e deve ser corrigida antes de tratar o endpoint como seguro.
