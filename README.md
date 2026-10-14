# ARquest

ARquest é um projeto aberto para criar telas virtuais posicionadas no espaço com um celular Android e um computador Windows. A experiência combina rastreamento AR, gestos da mão, marcadores impressos e transmissão de telas do PC. O app Android nativo usa ARCore e OpenGL; a versão WebXR oferece recursos experimentais adicionais.

O projeto também aparece como **MR Passthrough Companion** em partes da interface e do código.

## Componentes

- `apps/android`: app Android nativo, com ARCore, OpenCV e referência impressa universal ID 100.
- `apps/windows` e `pc_server`: painel e servidor do PC, pareamento local, transmissão de telas e controle de monitores virtuais já instalados.
- `web_mobile_test`: experiência web/WebXR, rastreamento de mãos, janelas ancoradas e impressão do marcador em `/mobile/markers.html`.
- `unity_project`: protótipo Unity experimental.

O mesmo marcador impresso ID 100 serve para qualquer tipo de janela. O papel deve ficar plano e imóvel; a folha A4 é impressa em escala de 100%, com quadrado preto de 140 mm.

## Início rápido no PC

Requer Node.js LTS e Windows para os recursos de integração com monitores virtuais.

```powershell
cd pc_server
npm ci
npm start
```

Abra `http://localhost:3000` no PC. Para AR no celular, use o link HTTPS de pareamento mostrado pelo servidor e conecte os aparelhos à mesma rede. O servidor cria localmente um certificado HTTPS autoassinado em `pc_server/cert.json`; esse arquivo contém uma chave privada e não deve ser compartilhado.

Para imprimir a referência, abra `/mobile/markers.html` na instância local e imprima em escala real. Confirme a medida com a régua de 100 mm na folha.

## App Android nativo

Instale Android SDK Platform e Build Tools, além do JDK distribuído com Android Studio. Na raiz do projeto:

```powershell
powershell -File apps/android/build.ps1
```

O script baixa ARCore e OpenCV com checksums fixos e gera o APK em `output/packages/android/`. O app usa ARCore/Google Play Services para AR. Teste o APK em aparelho compatível antes de depender do rastreamento.

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

## Como colaborar

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir um pull request. Relatos de falhas podem ser enviados pela aba Issues. Não envie certificados, arquivos de build ou credenciais.

## Licença e terceiros

O código original deste projeto é disponibilizado sob a licença [MIT](LICENSE). Bibliotecas e modelos em `web_mobile_test/vendor` incluem seus avisos e licenças próprios. ARCore, OpenCV, Unity e o driver virtual são dependências externas com termos próprios; consulte os termos oficiais antes de redistribuí-los ou usá-los.
