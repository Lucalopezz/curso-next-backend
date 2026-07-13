# 6. Upload, rede e segurança

## Controles implementados

### Validação de entrada

`ValidationPipe` global usa:

- `whitelist: true`: remove propriedades não decoradas nos DTOs;
- `forbidNonWhitelisted: true`: neste projeto, em vez de aceitar silenciosamente campos extras, rejeita a requisição.

Os decorators `class-validator` verificam tipos, e-mail, strings, tamanho de título/excerto, URL, boolean e senha nova.

### Headers HTTP com Helmet

`helmet()` adiciona headers HTTP de proteção. A exceção explícita:

```ts
crossOriginResourcePolicy: { policy: 'cross-origin' }
```

facilita que imagens publicadas em `/uploads` sejam carregadas por outro frontend/origem. Isso não substitui CORS nem autenticação; trata-se de uma política de recurso cross-origin.

### CORS

O callback de CORS:

- permite requests sem `Origin` (comuns em curl, servidores e ferramentas de teste);
- permite somente origins presentes em `CORS_WHITELIST`;
- rejeita uma origin de navegador desconhecida.

CORS é uma política aplicada pelo navegador para controlar quem pode ler respostas; não é um mecanismo de autenticação. Um atacante ainda pode fazer requests server-to-server, e o endpoint precisa continuar protegido pelo guard.

### Rate limiting

`ThrottlerModule` configura uma janela de 10 segundos com limite de 10 requests e bloqueio de 5 segundos. `ThrottlerGuard` é provider global, então o limite alcança todos os endpoints, salvo alguma configuração futura que o substitua.

Esse limite é uma proteção básica contra abuso e tentativas repetidas. Ele não substitui uma política específica de login, nem garante o mesmo resultado em múltiplas instâncias se o armazenamento do contador não for compartilhado.

### Senhas

O código nunca compara senha em claro com igualdade simples. `BcryptHashingService` usa `bcryptjs.genSalt(10)` e `bcrypt.hash`, e `compare` verifica a senha informada contra o hash salvo.

O salt faz parte do próprio hash bcrypt. Por isso não existe coluna separada para salt.

### Respostas e dados sensíveis

Os response DTOs omitem a senha. O filtro global também evita devolver a stack de uma exceção desconhecida, retornando `Internal Server Error`.

## Pipeline de upload

```text
multipart/form-data
    ▼
FileInterceptor('file', memoryStorage, fileFilter)
    ▼
fileFilter: mimetype começa com image/
    ▼
UploadService: arquivo existe?
    ▼
UploadService: tamanho <= 900 * 1024?
    ▼
fileTypeFromBuffer: valida assinatura real
    ▼
aceita png/jpeg/webp/gif
    ▼
uploads/<data UTC>/<timestamp>-<sufixo>.<extensão detectada>
```

O MIME informado pelo cliente é usado apenas como filtro preliminar. A decisão final usa os bytes do buffer, o que dificulta simplesmente renomear um arquivo malicioso para `.png`. O nome original não é usado no caminho final, reduzindo riscos de path traversal e colisão por nome.

## Riscos e lacunas observados

### Alto: invalidação de JWT incompleta

`forceLogout` pode rejeitar tokens enquanto está `true`, mas o próximo login o redefine para `false` e desbloqueia tokens antigos ainda válidos. A correção é uma versão de sessão/denylist, explicada na seção correspondente de [autenticação](./05-autenticacao-e-autorizacao.md).

### Alto: autorização na exclusão de post

`PostService.remove` busca o post sem autor antes de executar o delete condicionado. Isso pode devolver conteúdo de um post de outra pessoa para um usuário que conhece o UUID. A busca deve ser `findOneOwnedOrFail(postData, author)` antes da exclusão.

### Médio: upload em memória sem limite do Multer

`limits` é exportado como objeto vazio. Embora o service rejeite arquivos acima de 900 KB, `memoryStorage` já pode ter acumulado o upload inteiro na memória antes dessa verificação. Um cliente pode enviar muitos arquivos grandes e pressionar memória.

Melhoria: configurar `limits.fileSize` no Multer, limitar request body no proxy, adicionar limite de quantidade/frequência por usuário e preferir gravação assíncrona/streaming quando necessário.

### Médio: arquivo público por padrão

Depois de salvo, qualquer pessoa que conheça a URL pode ler o arquivo em `/uploads`. Isso pode ser correto para capas públicas, mas não deve ser usado para documentos privados. Se houver conteúdo privado, servir por controller autenticado ou usar storage privado com URLs assinadas.

### Médio: e-mail do autor exposto

`PostResponseDto` sempre inclui `author.email`, inclusive em `/post` e `/post/:slug`. Se a intenção do blog não for publicar o contato, criar um DTO público de autor sem e-mail.

### Médio: `synchronize` em produção

Se `DB_SYNCHRONIZE=1` for levado ao deploy, mudanças no modelo podem causar alterações destrutivas. Usar migrations e `0` em produção.

### Baixo: senha de cadastro sem tamanho mínimo

`CreateUserDto` só exige string não vazia. `UpdatePasswordDto` exige 6 caracteres. As duas operações deveriam compartilhar uma política explícita, incluindo tamanho máximo para evitar entradas abusivas.

### Baixo: e-mail sem normalização

`UserService` procura exatamente o valor recebido. `Lucas@Email.com`, `lucas@email.com` e valores com espaços podem ser tratados de forma inconsistente dependendo do banco. Normalizar antes de consultar/salvar e manter a constraint única.

### Baixo: operações síncronas no upload

`existsSync`, `mkdirSync` e `writeFileSync` bloqueiam o event loop do Node durante operações de filesystem. Em baixo volume isso é simples; sob carga pode aumentar latência. A alternativa é usar APIs assíncronas e estratégia de storage adequada.

### Baixo: falta de observabilidade

Existe logger explícito para falha de criação de post, mas não há logging estruturado de login, falhas de autenticação, uploads, exclusões, correlation ID ou métricas. Logs de autenticação devem evitar senha e token.

## Modelo de ameaça resumido

| Ameaça | Controle atual | O que falta |
|---|---|---|
| senha vazada no banco | bcrypt | política uniforme de senha, rotação e monitoramento |
| enumeração por login | mesma mensagem para e-mail/senha inválidos | proteção específica por IP/conta |
| JWT adulterado | assinatura + secret | rotação de secret, versão de sessão e refresh/logout explícito |
| acesso a post de outro usuário | filtros de autor em quase todas as consultas | corrigir `remove` e testar IDOR sistematicamente |
| campos extras no body | `forbidNonWhitelisted` | testes cobrindo cada DTO |
| upload com extensão falsa | `file-type` no buffer | limite no Multer, antivírus/normalização se necessário |
| abuso de endpoints | throttler global | storage distribuído e limites por operação |
| acesso cross-origin indevido | whitelist CORS | configurar corretamente por ambiente e não confundir com auth |
