# Aplicativos MR Companion — primeira versão

## Windows

Compile com `powershell -File apps/windows/build.ps1` na raiz do projeto, depois de `npm ci` em `pc_server`.
Abra `output/packages/windows/MRCompanion/MRCompanion.exe`. Distribua a pasta inteira: ela inclui o Node, o servidor e os arquivos web; copiar apenas o EXE não basta. O destino precisa de Windows x64 com .NET Framework 4.x. Não precisa instalar Node.

O programa mantém seu próprio servidor nas portas 3010 (painel), 3453 (HTTPS) e 8090 (WebSocket), sem interromper a instância de desenvolvimento em 3002. Abra o painel pelo botão, compartilhe os monitores e use o link de pareamento gerado por esta instância. Fechar o programa encerra o servidor que ele iniciou. Portas ocupadas são informadas, sem encerrar processos externos.

Certificado e registros ficam em `%LOCALAPPDATA%/MRCompanion`. O driver de monitores virtuais continua sendo uma instalação separada e não é incluído no pacote. A captura de tela permanece no navegador e depende da seleção explícita do usuário. Esta versão é portátil e não tem instalador, atualização automática ou assinatura de distribuição.

## Android

Compile com `powershell -File apps/android/build.ps1`. O script utiliza o JDK do Android Studio e o SDK instalado no perfil do usuário; os parâmetros `-Java` e `-Sdk` permitem outros caminhos. Não depende de Gradle: compila Java, gera DEX e empacota e assina com as ferramentas oficiais do SDK.

O resultado atual é `output/packages/android/MRCompanion-native-debug.apk` (0.13.0), assinado com a mesma chave de desenvolvimento local em `%LOCALAPPDATA%/MRCompanion/build-keys`. Inclui MediaPipe para landmarks de até duas mãos e controles de pinça, modo duas lentes e leitor de QR para parear com o PC. Atualiza as versões anteriores sem desinstalar. O APK antigo `MRCompanion-debug.apk` era um lançador do Chrome e está obsoleto. Não é uma versão para publicar na Play Store.

Abra o aplicativo e toque em **Abrir espaço AR**. Autorize a câmera e a instalação/atualização do Google Play Services para AR, se solicitada. Mova o celular devagar para reconhecer superfícies. Leia o marcador ID 100; a tela mostra o erro de reprojeção, o tamanho do lado em pixels e uma confiança estimada. O app combina até oito quadros e só define a origem com seis leituras consistentes e confiança suficiente. Depois mire uma superfície detectada e toque em **Criar na superfície**; a solicitação espera até confirmar o mesmo plano por pelo menos oito quadros e 850 ms. O ID 100 não prende janelas. A lista **Painel selecionado** permite selecionar qualquer painel; **Menor**, **Maior** e **Remover** atuam nele. Até 24 painéis e suas poses relativas ao marcador ficam guardados localmente; ao reabrir, mostre o ID 100 novamente para reconstruir as âncoras da sessão.

Esta versão renderiza câmera e painéis diretamente com OpenGL ES e ARCore no Android. Não usa WebView, Chrome, WebXR ou servidor para a experiência local. O Google Play Services para AR continua sendo uma dependência de plataforma. O rastreamento de mãos usa MediaPipe localmente e processa até duas mãos em frequência adaptativa de até 15 quadros/s. Mostre primeiro a mão aberta; depois faça pinça na barra inferior ou no painel para movê-lo. O arraste preserva o plano e a profundidade iniciais e permanece ligado à mão que o iniciou. Solte para gravar a nova posição. Duas pinças sobre a mesma janela mudam seu tamanho. Durante o mapeamento, amostras de profundidade que concordam com o plano refinam sua posição e registram suporte de profundidade; se o aparelho não fornecer profundidade, o plano visual do ARCore continua sendo usado. O modo duas lentes pede orientação horizontal, mostra duas imagens do passthrough da câmera traseira e renderiza as janelas com deslocamento estéreo. Como o celular tem uma câmera traseira, o fundo do ambiente permanece monocular. Os painéis locais desta base são cartões de teste, não computadores remotos. A transmissão de conteúdo de monitores do PC ainda não foi migrada para o APK.

### Referência impressa universal no Android

Use a folha A4 de /mobile/markers.html: origem ID 100 com quadrado preto de 100 mm e etiquetas de superfície ID 101–103 com 70 mm. O quadrado maior e os auxiliares são o mesmo padrão visual ArUco; apenas os IDs e tamanhos diferem. Textos das etiquetas são discretos, mas os códigos continuam em preto e branco para manter leitura confiável. Uma impressão ID 100 antiga de 140 mm ainda funciona se você inserir 140 mm no campo de tamanho. Mostre uma única cópia do ID 100 por vez.

Consulte o [guia de posicionamento e leitura dos marcadores](../docs/GUIA_POSICIONAMENTO_MARCADORES.md) para escolher onde fixar a origem, a distância de leitura e quantas etiquetas realmente são necessárias. No APK atual, uma única cópia fixa do ID 100 é suficiente; os IDs 101–103 são opcionais e não aumentam a precisão da origem.

1. Em **Lado (mm)**, informe o lado externo preto do ID 100, sem a margem branca (100 mm na folha nova).
2. Mostre o ID 100 inteiro e aguarde leituras estáveis. IDs 101–103 aparecem como etiquetas de orientação para horizontal, vertical e teto.
3. O painel mostra a posição da câmera no sistema da referência: X aponta à direita, Y para cima e Z perpendicular para fora do papel.
4. Toque em **Referência** para definir a origem. Aponte a mira para chão, mesa ou parede detectada pelo ARCore e toque em **Criar na superfície** para colocar uma janela.
5. A configuração e as poses das janelas são armazenadas no aparelho relativamente ao ID 100. Ao reabrir, releia o marcador; se ele tiver sido movido, as posições recuperadas também mudam.

OpenCV 4.12.0 detecta os quatro cantos e solvePnP IPPE_SQUARE estima a pose com o tamanho medido e a calibração da imagem fornecida pelo ARCore. Resultados antigos, cortados, pequenos, com erro de reprojeção alto ou fora de 0,15 a 4 m são descartados. A impressão, foco, luz e lente afetam a medida; as casas decimais exibidas não comprovam precisão milimétrica. O mapeamento guiado salva até 48 polígonos de planos ARCore relativamente ao ID 100, mas o app ainda não gera uma malha 3D completa. Os IDs 101–103 aparecem no diagnóstico como etiquetas de orientação; não são usados para fechar limites automaticamente.

Teste no aparelho físico ainda é necessário para confirmar a precisão. O teste de geometria verifica os eixos, unidades, estabilidade e os bits do mesmo ID 100 gerado pelo projeto.

### Editar o Android pelo computador

Use os pacotes PC e Android atualizados. No painel do PC, abra **Editar Android** (`/native.html`) e toque em **Mostrar QR de pareamento**. No APK, toque em **Ler QR do computador** e enquadre o QR; o celular e o PC precisam estar na mesma rede Wi-Fi, com a porta HTTPS do servidor acessível. O leitor usa a câmera localmente e valida o endereço, token e certificado antes de guardar o pareamento cifrado. O QR muda quando o servidor reinicia. O pareamento é opcional e não altera a execução nativa da câmera ou do AR.

O editor inclui os controles de edição do APK: marcador ID 100 e seu lado preto em mm, definir origem do espaço, criar painéis independentes em superfícies detectadas, selecionar, remover e redimensionar, além de ligar/desligar o rastreamento de mãos e o modo duas lentes. Também permite abrir e sair do AR quando o aplicativo está em primeiro plano. Permissão de câmera e instalação do Google Play Services para AR continuam sendo ações do sistema no celular. O painel mostra quantidade/tamanho de painéis, origem, medidas e mensagens do aparelho. Mudanças locais aparecem no PC; campos que você está editando não são sobrescritos pela atualização automática.

A seleção, o tamanho e a contagem dos painéis sincronizam entre APK e PC. O celular executa as mesmas operações para botões locais e comandos do PC. Criar painel e definir referência são solicitações para o próximo frame AR: o recebimento não garante uma superfície ou marcador válidos. Confira as mensagens, a origem e a quantidade de painéis para saber o resultado. A posição depende da câmera do celular; o editor não transmite prévia de vídeo e não implementa ainda monitores Windows no APK.

A conexão usa HTTPS e confere o SHA-256 do certificado incluído no QR de pareamento, sem desativar validação para outros certificados. O pareamento é guardado cifrado com chave Android Keystore e reconecta ao abrir o app; como o servidor troca o token ao reiniciar, gere e leia outro QR nesse caso. **Desconectar do PC**, no menu do Android, interrompe a comunicação e apaga o pareamento guardado. Comandos são direcionados ao dispositivo selecionado, têm IDs para evitar repetição e expiram em cinco segundos. Edição exige aplicativo ativo; solicitações antigas não são reproduzidas ao reconectar. APIs administrativas só aceitam o painel local, com validação de origem nas alterações.

Validação: testes do roteador de comandos, teste do parser do código, conexão TLS real usando as classes Java do APK (incluindo rejeição de certificado incorreto), e teste do painel com Android simulado para comandos, sincronização de estado e layout estreito. O teste completo no aparelho físico continua pendente. As classes de TLS podem ser verificadas no JDK com `NativeTlsTest.java`; ele lê o código pela entrada padrão, sem imprimi-lo.

Consulte [janelas espaciais e interação por mãos](../docs/JANELAS_ESPACIAIS.md) para os gestos e limites da versão 0.13. Os testes de regressão puros rodam com `powershell -File apps/android/test-core.ps1` e no CI, sem câmera ou SDK Android.
