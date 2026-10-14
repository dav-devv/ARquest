# Plano de testes: Infinix Note 40 5G + PC

Este roteiro estabelece uma referência prática para encontrar problemas de reconhecimento, deriva das janelas, fluidez e conexão. Faça os testes na ordem indicada e altere uma configuração por vez. Os resultados são uma linha de base; não representam uma certificação do aparelho.

## O que será testado

Há dois fluxos diferentes. Anote qual deles está usando em cada resultado:

| Fluxo | Como abrir | O que avaliar |
|---|---|---|
| APK Android nativo | Abra o MR Companion instalado e toque em **Abrir espaço AR**. | Rastreamento ARCore, marcador ID 100, posicionamento e recuperação da sessão. Este fluxo não recebe vídeo do PC nem oferece mãos e duas lentes. |
| AR WebXR no Chrome | Inicie o servidor no PC e abra no celular o link HTTPS pareado; entre no modo AR. | Âncoras WebXR, FPS de cena/vídeo, transmissão do PC, mãos opcionais e reconexão. A disponibilidade varia com o Chrome e o runtime AR do aparelho. |
| Painel do PC | Abra `http://localhost:3000`; para os controles do APK, use **Editar Android**. | Pareamento, estado do dispositivo e comandos entre o PC e o APK. |

Não compare diretamente FPS do WebXR com a sensação visual do APK: o APK atual não exibe um contador de FPS. Para números do modo nativo, use uma captura de desempenho do Android Studio/Perfetto como uma etapa separada; sem ela, registre apenas a avaliação visual.

## Preparação (3–5 minutos)

- Anote a versão/build do APK ou a URL/versão web usada. O roteiro foi escrito para o APK nativo 0.5.0 e o código atualmente no projeto; registre uma versão diferente se for o caso.
- No Infinix Note 40 5G, registre a versão do Android, o patch de segurança, a versão do Chrome e a versão do Google Play Services para AR. Não é necessário compartilhar IMEI, número de série, link de pareamento ou token.
- No PC, registre a versão do Windows, CPU, GPU, RAM e se o PC está conectado por Wi-Fi ou cabo. Confirme que celular e PC estão na mesma rede local; desligue VPN durante o teste de conexão, se houver.
- Deixe o celular esfriar até a temperatura normal, desconecte o carregador durante a comparação e feche apps pesados. Mantenha o brilho, a iluminação e o local iguais entre repetições.
- Imprima a referência universal ID 100 em A4 a 100%. Meça apenas a borda externa preta: o padrão é 140 mm. Fixe a folha plana e imóvel, com boa iluminação, e use só uma cópia visível.
- Se o Android pedir, autorize a câmera e atualize/instale o Google Play Services para AR. Não aceite uma falha silenciosa: anote a mensagem apresentada.

## Teste 1 — início e reconhecimento de superfície (APK nativo)

1. Abra **Abrir espaço AR**. Registre o tempo aproximado até a câmera aparecer e a mensagem de estado.
2. Em uma mesa com detalhes visíveis e boa luz, mova o celular lentamente por cerca de 20 segundos.
3. Quando a mira central apontar para uma superfície, toque em **Fixar painel**. Repita cinco vezes, removendo o painel anterior entre tentativas.
4. Anote quantos posicionamentos funcionaram, se houve congelamento ou tela preta, e se o painel apareceu na superfície indicada.

**Registro:** `___/5` posicionamentos; estado/mensagem: `___`; falhas ou demora: `___`.

## Teste 2 — estabilidade da janela ancorada (APK nativo)

1. Fixe um painel próximo a um objeto fácil de reconhecer, como o canto de uma mesa ou uma folha na parede.
2. Fique parado por 30 segundos e observe se a janela desliza em relação ao objeto. Não mova a folha impressa durante este teste.
3. Desloque o celular cerca de um metro para o lado, gire para observar o painel de outro ângulo e volte ao ponto inicial.
4. Repita o trajeto três vezes. Anote separadamente perda temporária de rastreamento, quanto demorou para recuperar e se a janela voltou ao mesmo lugar no ambiente.

Use esta escala para a deriva aparente: `0` imperceptível; `1` pequena, mas visível; `2` grande ou claramente deslocada; `3` âncora perdida/janela ausente. Não tente estimar centímetros sem uma medida física de referência.

**Registro:** deriva nas três repetições `___ / ___ / ___`; recuperou após perda? `sim/não`; observações: `___`.

## Teste 3 — referência métrica impressa ID 100 (APK nativo)

1. Prenda a folha ID 100 numa parede. Em **Lado (mm)**, confirme a medida externa real (padrão 140 mm).
2. Mostre o quadrado inteiro, mantenha o celular firme e aguarde as quatro leituras estáveis.
3. Toque em **Referência** e confirme no estado que a origem foi criada. Registre as medidas X, Y, Z e a distância exibidas, sem tratá-las como precisão milimétrica comprovada.
4. Afaste o celular, volte à posição inicial e faça três novas leituras, sem mover a folha. Anote se a origem e os valores se repetem de forma semelhante.
5. Fixe um painel e confirme que ele aparece à frente da folha. O marcador serve a qualquer tipo de janela; só uma cópia deve estar visível durante a leitura.

**Registro:** leituras confirmadas `___/3`; mensagens: `___`; valores de distância observados: `___`; posicionamento à frente da folha: `sim/não`.

## Teste 4 — fluidez e transmissão (WebXR no Chrome)

1. Abra o AR pelo link HTTPS pareado. Se o app não iniciar o AR, registre a mensagem de compatibilidade; não substitua a falha por uma medida de FPS.
2. Abra **Diagnóstico**. Confirme que `Cena: ... FPS` e `Vídeo do PC: ... FPS` estão visíveis.
3. Faça três medições de 60 segundos em cada condição, deixando o aparelho esfriar entre as condições:
   - AR sem janela de monitor e sem mãos;
   - AR com uma janela de monitor, PC compartilhando uma tela, mãos desligadas;
   - a mesma janela e transmissão, com mãos ativadas, se esse controle estiver disponível.
4. A cada 15 segundos, anote FPS de cena, FPS do vídeo e qualidade reportados. Observe também engasgos, atraso percebido e se o celular aquece. Não grave a tela durante a linha de base, porque a gravação adiciona carga.
5. Compare a mediana dos valores anotados em cada condição. O contador de cena mede quadros XR rastreados; o de vídeo mede atualizações da textura do monitor. Nenhum dos dois, sozinho, mede latência ponta a ponta.

| Condição | Repetição 1 | Repetição 2 | Repetição 3 | Engasgos/temperatura |
|---|---|---|---|---|
| AR sem monitor/mãos |  |  |  |  |
| Monitor do PC, mãos desligadas |  |  |  |  |
| Monitor do PC, mãos ligadas (opcional) |  |  |  |  |

## Teste 5 — pareamento e reconexão PC/celular

1. Com o servidor ligado, abra **Editar Android** no painel do PC e conecte o APK pelo menu **Conectar ao PC**.
2. Confirme que o painel mostra o celular conectado e o estado `AR`/`ativo` quando o AR está em primeiro plano.
3. Mude **Lado (mm)** pelo PC e confira no telefone; depois altere-o no telefone e confirme a atualização no painel. Use uma medida temporária válida e restaure a medida correta no final.
4. Feche e reabra a tela de edição do PC. Em seguida, desconecte e conecte novamente o celular. Confirme que o dispositivo volta a aparecer e que comandos novos funcionam.
5. Reinicie o servidor só como última etapa: o código de pareamento muda após a reinicialização e deve ser gerado novamente.

**Registro:** conexão inicial `sim/não`; PC → telefone `sim/não`; telefone → PC `sim/não`; reconexão `sim/não`; mensagens: `___`.

## Teste 6 — pausa e retomada

Faça no APK nativo e, separadamente, no Chrome: com uma janela posicionada, troque para outro app por 10 segundos e volte. Anote se a câmera/AR retomam, se a janela continua ancorada e quanto demora. Não conte o comportamento de um fluxo como evidência do outro: Android pode pausar cada app/navegador de forma diferente.

**Registro:** fluxo `___`; retomou sem reiniciar? `sim/não`; janela permaneceu alinhada? `sim/não`; demora/mensagem: `___`.

## Como interpretar e escolher a próxima melhoria

- Falha já no Teste 1 sugere investigar compatibilidade do ARCore, permissão da câmera, iluminação ou detecção de superfície antes de ajustar janela.
- O Teste 1 passa, mas a janela deriva no Teste 2: investigar rastreamento espacial/âncoras e repetir com a referência impressa para separar deriva do ARCore de erro da folha.
- O marcador falha no Teste 3, mas superfícies funcionam: verificar escala da impressão, tamanho preto informado, foco, luz e se o quadrado está inteiro no quadro.
- FPS cai apenas ao transmitir monitor: investigar resolução, taxa de quadros e carga da rede/PC. FPS de cena baixo mesmo sem monitor aponta para carga de renderização ou do aparelho.
- Perda de conexão no Teste 5 sem perda de rastreamento indica um problema de rede/pareamento separado do AR.
- Se os resultados variam entre repetições, repita em condições controladas antes de escolher uma otimização.

Preencha [o modelo de resultado](MODELO_RESULTADO_TESTE.md) e anexe ao relatório da issue. Oculte IPs públicos, tokens, QR/códigos de pareamento, IMEI, número de série e qualquer rosto capturado.
