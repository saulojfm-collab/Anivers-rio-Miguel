# ⚽ Copa do Miguel — 10 anos

Campeonato do aniversário no **Condomínio Maria Isabel 1**. Aplicação responsiva em português com servidor Node, atualização ao vivo por SSE e persistência em PostgreSQL (produção) ou arquivo JSON (desenvolvimento).

## Executar

Node 22.13+ (recomendado 24). No diretório do repositório:

```sh
npm ci
npm test
npm start
```

Porta padrão: 3000. A senha **apenas para desenvolvimento** é `miguel10`. Defina `ADMIN_PASSWORD` com no mínimo oito caracteres antes de compartilhar o sistema. Em `NODE_ENV=production`, a senha é obrigatória e o cookie usa HTTPS. Não coloque a senha no link dos convidados nem no Git.

## Publicar no Render

1. Envie este código ao repositório GitHub conectado ao Render.
2. No Render, escolha **New → Blueprint**, selecione o repositório e aplique `render.yaml`.
3. Informe `ADMIN_PASSWORD` na configuração segura do serviço. O Blueprint cria um serviço web e um PostgreSQL, vinculando `DATABASE_URL` automaticamente.
4. Quando a implantação terminar, abra o endereço HTTPS fornecido pelo Render. Faça uma inscrição de teste e confira a visualização em outro celular antes de divulgar.
5. Envie o endereço público com `/?inscricao=1` aos convidados: o formulário de inscrição abre diretamente. Só o organizador usa a senha.

A configuração usa os planos gratuitos. O serviço gratuito pode hibernar e demorar a responder na primeira visita; abra-o antes dos jogos. O PostgreSQL gratuito do Render tem prazo limitado (normalmente 30 dias); confira as condições atuais no painel e mantenha o banco ativo até concluir a festa. O botão **Backup da copa**, na área do organizador, baixa todos os dados em JSON. Faça backups durante e ao final do torneio. Não use o JSON local como armazenamento de produção no Render: o disco do serviço gratuito é efêmero.

A implantação não foi executada por este projeto: requer sua conta Render e o código no GitHub. O PostgreSQL e o provisionamento precisam ser verificados após a publicação; os testes automatizados locais usam o armazenamento JSON.

## Fluxo no dia da festa

- Não há um total fixo de 20 participantes: esse número é apenas uma estimativa. É possível abrir as inscrições sem cadastrar qualquer time e montar os elencos no dia da festa com o total real.
- Convidados se inscrevem com nome, idade entre 5 e 12 anos e um ídolo. Inscrições duplicadas pelo mesmo nome são recusadas.
- Dados de inscrição são públicos a quem tem o link; não peça telefone, endereço nem fotos das crianças. Avatares usam ilustrações SVG leves e nomes de 24 ídolos, incluindo Neymar, Haaland, Kane, Messi e jogadores ligados a clubes brasileiros. **Não são retratos reais dos jogadores.**
- Monte os times manualmente para equilibrar idade e habilidade. Sugestão para 20 crianças: quatro equipes de cinco (quatro na linha e um goleiro). Não há limite rígido de cinco para permitir reservas. Escolha nome, símbolo e capitão.
- Antes do campeonato, é possível desmontar times e redistribuir jogadores. Gerar os jogos fecha as equipes; confirme só após revisar.
- Todos jogam contra todos na classificação. Vitória vale 3 pontos; empate, 1. Com dois times, há ida e volta antes da final, garantindo outra oportunidade de jogar. Para três times, os dois primeiros fazem a final. Com quatro ou mais, os quatro melhores fazem semifinais (1º × 4º, 2º × 3º), final e bronze.
- Desempate da classificação: pontos, vitórias, saldo de gols, gols marcados e ordem de cadastro dos times. O último critério evita uma decisão implícita no dia; a regra aparece na tabela.
- Com quatro equipes: seis partidas de classificação + duas semifinais + bronze + final = dez partidas. Com mais equipes, a classificação tem N×(N−1)/2 jogos; planeje o tempo antes de confirmar.
- Lance cada gol escolhendo time, autor e assistência opcional. O mesmo jogador não pode marcar e assistir o mesmo gol. Desfaça o último gol enquanto a partida estiver aberta.
- Confira o placar antes de encerrar. Resultados encerrados não são editáveis para preservar os confrontos seguintes. Nas finais, informe os pênaltis quando houver empate; pênaltis não somam à artilharia.
- Todos acompanham os placares e rankings sem atualizar manualmente. Bola de Ouro para artilheiros, Passe de Ouro para assistentes e destaque para participações em gols; empates compartilham a premiação. O campeão aparece com troféu animado e elenco; vice e terceiro também aparecem.

## Configuração

| Variável         | Uso                                                |
| ---------------- | -------------------------------------------------- |
| `ADMIN_PASSWORD` | Senha do organizador (obrigatória em produção)     |
| `DATABASE_URL`   | URL PostgreSQL; o esquema é criado automaticamente |
| `PORT`           | Porta HTTP, padrão 3000                            |
| `NODE_ENV`       | `production` exige senha e HTTPS                   |
| `DATA_FILE`      | Arquivo JSON local, padrão `data/state.json`       |

Execute uma única instância do servidor: o estado em memória e os eventos SSE são próprios de cada instância. As gravações são serializadas e confirmadas no banco antes de notificar os convidados. Falhas de gravação revertem a alteração em memória.

## Validação

`npm test` verifica torneios de 2 a 16 times, segunda oportunidade, pontos, desempates, avanço das finais e uma integração HTTP com inscrição, autorização, gols e assistências, bronze e persistência após reinício. Sem dependências de serviços externos para testar.

`npm run test:browser` executa uma simulação isolada com 20 jogadores, quatro equipes e dez partidas, conferindo atualização ao vivo em outro navegador e telas de celular. Requer Chromium em `/usr/bin/chromium` ou um caminho definido em `BROWSER_EXECUTABLE_PATH`. O teste usa dados temporários, sem alterar o campeonato real.
