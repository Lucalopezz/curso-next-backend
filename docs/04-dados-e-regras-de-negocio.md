# 4. Dados e regras de negócio

## Entidade `User`

Arquivo: `src/user/entities/user.entity.ts`.

| Campo | Tipo/constraint | Função |
|---|---|---|
| `id` | UUID, PK | identidade do usuário |
| `name` | coluna obrigatória | nome exibido |
| `email` | obrigatório e único | identificador usado no login |
| `password` | obrigatório | hash bcrypt; nunca deve conter senha em claro |
| `forceLogout` | boolean, default `false` | sinal global para rejeitar tokens na estratégia JWT |
| `createdAt` | data automática | criação |
| `updatedAt` | data automática | última atualização |

## Entidade `Post`

Arquivo: `src/post/entities/post.entity.ts`.

| Campo | Tipo/constraint | Função |
|---|---|---|
| `id` | UUID, PK | identidade do post |
| `title` | obrigatório | título |
| `slug` | obrigatório e único | URL pública |
| `content` | `text` | conteúdo completo |
| `excerpt` | obrigatório | resumo |
| `coverImageUrl` | opcional | URL retornada pelo upload ou outra URL válida |
| `published` | boolean, default `false` | controla exposição pública |
| `createdAt`/`updatedAt` | datas automáticas | auditoria básica |
| `author` | `ManyToOne(User)` | dono do post |

O relacionamento define `onDelete: 'CASCADE'`: quando um usuário é apagado, o banco deve remover seus posts relacionados. Isso evita posts órfãos, mas também torna a exclusão de conta destrutiva; em produto real pode ser preferível soft delete/anonymização.

## Criação de usuário

1. `UserController` recebe `CreateUserDto`.
2. A `ValidationPipe` verifica formato e presença.
3. `UserService.failIfEmailExists` faz uma consulta preventiva.
4. `HashingService` gera salt e hash bcrypt com cost `10`.
5. O service monta um objeto com somente nome, e-mail e senha já hasheada.
6. TypeORM salva o registro.
7. `UserResponseDto` remove campos internos da resposta.

O `unique` do banco é indispensável porque a checagem prévia tem uma janela de corrida: duas requisições simultâneas podem passar pela consulta antes de qualquer uma salvar.

## Criação de post e slug

`createSlugFromText` executa:

1. `normalize('NFKD')` separa acentos;
2. remove marcas Unicode de acentuação;
3. converte para minúsculas;
4. substitui caracteres fora de `[a-z0-9]` por espaço;
5. troca grupos de espaços por hífen;
6. adiciona `-` e um sufixo pseudoaleatório de 6 caracteres.

Exemplo conceitual:

```text
"Introdução à rede" → "introducao-a-rede-abc123"
```

O sufixo reduz colisões entre títulos iguais. O campo continua `unique`, e o `catch` da criação converte qualquer falha de save em `400` enquanto registra a stack no logger do Nest.

## Consultas de posse

Para listar/consultar posts próprios, o service usa uma condição equivalente a:

```text
WHERE post.id = :id AND author.id = :authenticatedUserId
```

Essa combinação é uma defesa contra IDOR (Insecure Direct Object Reference): conhecer o UUID de outro usuário não deveria ser suficiente para ler ou alterar seu post.

## Atualizações e exclusões

- Atualizar e-mail marca `forceLogout=true`.
- Atualizar senha compara a senha atual com bcrypt, gera novo hash e marca `forceLogout=true`.
- Login bem-sucedido marca `forceLogout=false`.
- Excluir conta executa `delete({ id })` e devolve uma representação do usuário removido.
- Excluir usuário deve acionar o cascade dos posts.

### Ponto de atenção na exclusão de post

O método `PostService.remove` primeiro chama `findOneOrFail(postData)`, sem filtrar pelo autor, e só depois executa o `delete` com `author.id`. Na prática, um usuário pode obter na resposta os dados de um post alheio conhecido, embora o `delete` condicionado não o remova. A implementação segura deve buscar primeiro com `findOneOwnedOrFail` e somente então excluir o objeto já comprovadamente pertencente ao usuário.

## Limitações de modelagem

- Não há paginação em listagens públicas ou privadas.
- Não há índices explicitamente declarados para consultas frequentes além das constraints `unique`.
- Não há migration versionada.
- Não há status de arquivamento ou soft delete.
- Não há entidade reversa `User.posts`; a relação é navegada pelo `Post.author`.
- O e-mail é usado como login, mas não é normalizado (`trim`/lowercase) antes das consultas.
- O cadastro não aplica `MinLength` à senha, embora a troca de senha aplique 6 caracteres.
