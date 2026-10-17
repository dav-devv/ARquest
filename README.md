# ARquest

ARquest é um projeto aberto para criar telas virtuais posicionadas no espaço com um celular Android e um computador Windows. A experiência combina rastreamento AR, gestos da mão, marcadores impressos e transmissão de telas do PC. O app Android nativo usa ARCore e OpenGL; a versão WebXR oferece recursos experimentais adicionais.

O projeto também aparece como **MR Passthrough Companion** em partes da interface e do código.

## Componentes

- `apps/android`: app Android nativo, com ARCore, OpenCV e origem espacial impressa ID 100.
- `apps/windows` e `pc_server`: painel e servidor do PC, pareamento local, transmissão de telas e controle de monitores virtuais já instalados.
- `web_mobile_test`: experiência web/WebXR, rastreamento de mãos, janelas ancoradas e impressão do marcador em `/mobile/markers.html`.
- `unity_project`: protótipo Unity experimental.

O marcador ID 100 define a origem do espaço; as janelas são posicionadas em planos detectados pelo ARCore e guardadas relativamente a essa origem. A folha A4 imprime o ID 100 com 100 mm e três etiquetas compactas de 70 mm para orientação de superfícies. O papel deve ficar plano e imóvel, em escala de 100%.

## Início rápido no PC

Requer Node.js LTS e Windows para os recursos de integração com monitores virtuais.

```powershell
cd pc_server
npm ci
npm start
```

Abra `http://localhost:3000` no PC. Para AR no celular, use o link HTTPS de pareamento mostrado pelo servidor e conecte os aparelhos à mesma rede. O servidor cria localmente um certificado HTTPS autoassinado em `pc_server/cert.json`; esse arquivo contém uma chave privada e não deve ser compartilhado.

Para imprimir a referência, abra `/mobile/markers.html` na instância local e imprima em escala real. Confirme a medida com a régua de 100 mm na folha.

O posicionamento, a distância de leitura e a quantidade recomendada de marcadores estão descritos no [guia de posicionamento dos marcadores](docs/GUIA_POSICIONAMENTO_MARCADORES.md).

## App Android nativo

Instale Android SDK Platform e Build Tools, além do JDK distribuído com Android Studio. Na raiz do projeto:

```powershell
powershell -File apps/android/build.ps1
```

O script baixa ARCore, OpenCV e MediaPipe com checksums fixos e gera o APK em `output/packages/android/`. A versão 0.9 salva configuração e posições de painéis em relação ao marcador ID 100 (100 mm), para relocalizar o espaço depois de reabrir. Janelas são posicionadas em superfícies detectadas, independentes dos marcadores. O app nativo agora inclui rastreamento de duas mãos com pinça e visualização em duas lentes, também controláveis pelo PC. O modo duas lentes duplica o passthrough monocular e dá paralaxe aos painéis virtuais; não produz visão estereoscópica do mundo físico. O app usa ARCore/Google Play Services para AR; confira os limites descritos em `apps/README.md`.

## Executável Windows

Requer Windows x64, .NET Framework 4.x e Node.js para preparar o pacote:

```powershell
npm ci --prefix pc_server
powershell -File apps/windows/build.ps1
```

O pacote portátil é criado em `output/packages/windows/MRCompanion/`. O driver de vídeo virtual é opcional, instala-se separadamente e não está incluído neste repositório. Sem ele, ainda é possível transmitir telas e janelas que o Windows já disponibiliza.

## Testes

```powershell
npm test --prefix pc_server
```

Há testes de geometria e marcadores, âncoras AR, interação, sincronização PC/celular e controle de telas. Os testes automatizados não substituem validação com câmera, headset e impressão reais.

Para validar o app no Infinix Note 40 5G e no PC, siga o [plano de testes físicos](docs/PLANO_TESTES_INFINIX_PC.md) e registre os resultados usando o [modelo de teste](docs/MODELO_RESULTADO_TESTE.md). O APK nativo e o WebXR têm recursos e métricas diferentes; o plano avalia cada fluxo separadamente.

Para coletar métricas do APK automaticamente pelo PC, pareie o app em **Editar Android**, deixe o AR aberto e execute `node tools/device-test/run-native-check.cjs`. O verificador guia as ações, registra FPS/estado de tracking/marcador e salva um relatório local. Os deslocamentos físicos ainda são feitos manualmente.

No Chrome com WebXR, abra `/mobile/ar.html?test=1`; o coletor no celular registra 60 segundos de FPS, transmissão e âncoras, guia um ciclo parado/movimento/retorno e baixa um JSON local. Os relatórios são diagnósticos práticos, não medidas de latência ponta a ponta ou precisão laboratorial.

## Como colaborar

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir um pull request. Relatos de falhas podem ser enviados pela aba Issues. Não envie certificados, arquivos de build ou credenciais.

## Licença e terceiros

O código original deste projeto é disponibilizado sob a licença [MIT](LICENSE). Bibliotecas e modelos em `web_mobile_test/vendor` incluem seus avisos e licenças próprios. ARCore, OpenCV, Unity e o driver virtual são dependências externas com termos próprios; consulte os termos oficiais antes de redistribuí-los ou usá-los.
