# Avisos de terceiros

O código original do ARquest é distribuído sob a licença MIT no arquivo [LICENSE](LICENSE).

Arquivos em `web_mobile_test/vendor` são componentes de terceiros. Consulte `NOTICE.md` e os arquivos `LICENSE.txt` nesse diretório para atribuição e termos aplicáveis.

ARCore, OpenCV, MediaPipe Tasks, Unity e o Virtual Display Driver são dependências externas. O build Android baixa MediaPipe Tasks Vision/Core e bibliotecas Java do Google Maven/Maven Central ao compilar; consulte as licenças de cada projeto antes de redistribuir binários. Seus SDKs, ferramentas e drivers mantêm licenças próprias. Os binários do driver virtual não são incluídos neste repositório.

O leitor de QR Android usa ZXing Core 3.5.3, distribuído sob Apache License 2.0; o build valida o SHA-256 do artefato baixado. O gerador de QR do painel do PC usa `qrcode` 1.5.4 sob MIT.
