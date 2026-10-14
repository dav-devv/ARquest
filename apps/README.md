# Aplicativos MR Companion — primeira versão

## Windows

Compile com `powershell -File apps/windows/build.ps1` na raiz do projeto, depois de `npm ci` em `pc_server`.
Abra `output/packages/windows/MRCompanion/MRCompanion.exe`. Distribua a pasta inteira: ela inclui o Node, o servidor e os arquivos web; copiar apenas o EXE não basta. O destino precisa de Windows x64 com .NET Framework 4.x. Não precisa instalar Node.

O programa mantém seu próprio servidor nas portas 3010 (painel), 3453 (HTTPS) e 8090 (WebSocket), sem interromper a instância de desenvolvimento em 3002. Abra o painel pelo botão, compartilhe os monitores e use o link de pareamento gerado por esta instância. Fechar o programa encerra o servidor que ele iniciou. Portas ocupadas são informadas, sem encerrar processos externos.

Certificado e registros ficam em `%LOCALAPPDATA%/MRCompanion`. O driver de monitores virtuais continua sendo uma instalação separada e não é incluído no pacote. A captura de tela permanece no navegador e depende da seleção explícita do usuário. Esta versão é portátil e não tem instalador, atualização automática ou assinatura de distribuição.

## Android

Compile com `powershell -File apps/android/build.ps1`. O script utiliza o JDK do Android Studio e o SDK instalado no perfil do usuário; os parâmetros `-Java` e `-Sdk` permitem outros caminhos. Não depende de Gradle: compila Java, gera DEX e empacota e assina com as ferramentas oficiais do SDK.

O resultado atual é `output/packages/android/MRCompanion-native-debug.apk` (0.6.0), assinado com a mesma chave de desenvolvimento local em `%LOCALAPPDATA%/MRCompanion/build-keys`. Atualiza as versões anteriores sem desinstalar. O APK antigo `MRCompanion-debug.apk` era um lançador do Chrome e está obsoleto. Não é uma versão para publicar na Play Store.

Abra o aplicativo e toque em **Abrir espaço AR**. Autorize a câmera e a instalação/atualização do Google Play Services para AR, se solicitada. Mova o celular devagar; quando a mira central encontrar uma superfície, toque em **Fixar painel**. Os controles **Menor**, **Maior** e **Remover último** atuam no último painel. Até 24 painéis locais podem existir durante a sessão; as âncoras não são salvas depois de sair.

Esta versão renderiza câmera e painéis diretamente com OpenGL ES e ARCore no Android. Não usa WebView, Chrome, WebXR ou servidor para a experiência local. O Google Play Services para AR continua sendo uma dependência de plataforma. Ainda faltam migrar WebRTC/monitores do PC, mãos/pinças e duas lentes. Os painéis locais desta base são cartões de teste, não computadores remotos. A versão web e o servidor do PC permanecem disponíveis separadamente.

### Referência impressa universal no Android

Use a folha única ID 100 de /mobile/markers.html, com o lado preto de 140 mm. É o mesmo desenho para biblioteca, monitor e qualquer outro tipo de janela. A impressão ID 100 anterior continua válida. ID 200 foi retirado. Uma folha pode servir a várias janelas; mostre uma só cópia por vez para evitar referências duplicadas ambíguas.

1. Em **Lado (mm)**, informe o lado externo do quadrado preto, sem a margem branca.
2. Mostre a folha ID 100 inteira e aguarde quatro leituras estáveis.
3. O painel mostra a posição da câmera no sistema da folha: X aponta à direita, Y para cima e Z perpendicular para fora do papel. Também mostra distância ao centro da folha.
4. Toque em **Referência** para fixar uma origem naquela pose. **Fixar painel** cria painéis 10 cm à frente da folha; sem referência, continua aceitando superfícies ARCore.
5. Depois que a folha sair da imagem, a posição passa a ser estimada pelo ARCore. Se mover a folha, defina a origem novamente.

OpenCV 4.12.0 detecta os quatro cantos e solvePnP IPPE_SQUARE estima a pose com o tamanho medido e a calibração da imagem fornecida pelo ARCore. Resultados antigos, cortados, pequenos, com erro de reprojeção alto ou fora de 0,15 a 4 m são descartados. A impressão, foco, luz e lente afetam a medida; as casas decimais exibidas não comprovam precisão milimétrica. O app não reconstrói a profundidade de todos os objetos da sala.

Teste no aparelho físico ainda é necessário para confirmar a precisão. O teste de geometria verifica os eixos, unidades, estabilidade e os bits do mesmo ID 100 gerado pelo projeto.

### Editar o Android pelo computador

Use os pacotes PC e Android atualizados. No painel do PC, abra **Editar Android** (`/native.html`) e gere um código. No menu principal do APK, toque em **Conectar ao PC** e cole esse código `mrcompanion://`. Ele é diferente do link HTTPS usado pela versão web. Os dois aparelhos devem estar na mesma rede; a porta HTTPS do servidor precisa estar acessível. O pareamento é opcional e não altera a execução nativa da câmera ou do AR.

O editor inclui todos os controles de edição atuais do APK: refer?ncia universal ID 100, lado preto em mm, definir referência, fixar painel, remover último e aumentar/diminuir último. Também permite abrir e sair do AR quando o aplicativo está em primeiro plano. Permissão de câmera e instalação do Google Play Services para AR continuam sendo ações do sistema no celular. O painel mostra quantidade/tamanho de painéis, origem fixa, medidas e mensagens do aparelho. Mudanças locais aparecem no PC; campos que você está editando não são sobrescritos pela atualização automática.

O celular executa as mesmas operações para botões locais e comandos do PC. Criar painel e definir referência são solicitações para o próximo frame AR: o recebimento não garante uma superfície ou marcador válidos. Confira as mensagens, a origem e a quantidade de painéis para saber o resultado. A posição depende da câmera do celular; o editor não transmite prévia de vídeo e não implementa ainda monitores Windows no APK.

A conexão usa HTTPS e confere o SHA-256 do certificado recebido no código de pareamento, sem desativar validação para outros certificados. O token não é persistido pelo APK; reiniciar o servidor exige novo código. **Desconectar do PC**, no menu do Android, interrompe a comunicação. Comandos são direcionados ao dispositivo selecionado, têm IDs para evitar repetição e expiram em cinco segundos. Edição exige aplicativo ativo; solicitações antigas não são reproduzidas ao reconectar. APIs administrativas só aceitam o painel local, com validação de origem nas alterações.

Validação: testes do roteador de comandos, teste do parser do código, conexão TLS real usando as classes Java do APK (incluindo rejeição de certificado incorreto), e teste do painel com Android simulado para comandos, sincronização de estado e layout estreito. O teste completo no aparelho físico continua pendente. As classes de TLS podem ser verificadas no JDK com `NativeTlsTest.java`; ele lê o código pela entrada padrão, sem imprimi-lo.
