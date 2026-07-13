# Documentação do backend

Este diretório explica o backend do blog a partir do código existente. A ideia é servir como material de revisão de NestJS, TypeScript, HTTP, banco de dados, autenticação e segurança.

## Roteiro recomendado

1. [Visão geral e arquitetura](./01-visao-geral-e-arquitetura.md)
2. [Execução e configuração](./02-execucao-e-configuracao.md)
3. [API HTTP](./03-api-http.md)
4. [Persistência e regras de negócio](./04-dados-e-regras-de-negocio.md)
5. [Login e ciclo de autenticação](./05-autenticacao-e-autorizacao.md)
6. [Upload, rede e controles de segurança](./06-upload-rede-e-seguranca.md)
7. [Testes, diagnóstico e próximos passos](./07-testes-diagnostico-e-evolucao.md)

## Escopo e convenções

- A documentação descreve o comportamento implementado, não um comportamento idealizado.
- Quando algo é uma recomendação e não existe no código, isso está indicado como **melhoria**.
- Os caminhos de arquivo são relativos à raiz do projeto.
- O servidor não possui prefixo global; portanto, as rotas começam diretamente por `/auth`, `/user`, `/post` e `/upload`.

## Mapa rápido do projeto

```text
src/
├── main.ts                  bootstrap, Helmet, CORS e validação global
├── app.module.ts            composição da aplicação, banco e controles globais
├── auth/                    login, JWT, Passport e guard
├── user/                    cadastro, perfil, senha e exclusão
├── post/                    posts públicos e posts do usuário autenticado
├── upload/                  recebimento e publicação de imagens
└── common/                  hashing, filtro de erros, pipes e utilitários
```

## Estado da validação

O código foi revisado estaticamente. Nesta cópia do repositório não há `node_modules`; por isso `npm run build` e `npm test -- --runInBand` não puderam executar. O build também exibiu erros de tipagem que precisam ser reavaliados depois de instalar as dependências, principalmente os tipos derivados de `PartialType` e o filtro de exceções.
