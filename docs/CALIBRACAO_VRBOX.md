# Calibrar a imagem do VR Box pelo computador

Abra o editor Android do ARquest no PC, conecte o celular e ative **Duas lentes**. O APK 0.11.0 ou mais recente habilita os controles novos. Mantenha o celular centralizado no suporte.

1. Em **Calibrar o VR Box**, abra **Mostrar grade de leitura**. Compare **Só esquerdo** e **Só direito**. A grade é gerada na resolução da tela e ajuda a distinguir o desfoque das lentes do desfoque da câmera. Ajuste **Altura nas lentes** para posicionar o desenho na parte mais clara da lente.
2. Selecione **Ambos os olhos**. Ajuste **União horizontal** até enxergar uma cruz central. Use **Diferença vertical entre os olhos** se as cruzes ficarem uma acima da outra. As barras, campos numéricos e botões −1/+1 controlam os mesmos valores. A união horizontal preserva a escala da imagem; bordas pretas podem aparecer conforme o deslocamento.
3. Clique **Voltar ao ambiente**. Observe um objeto parado e iluminado ou texto impresso. Experimente **Foco automático**; compare com **Foco fixo** para o ambiente distante. O ARCore só oferece esses dois modos, com suporte dependente do aparelho. Não são um controle de dioptrias das lentes do visor. [Referência do ARCore](https://developers.google.com/ar/reference/java/com/google/ar/core/Config.FocusMode).
4. Ajuste **Realce de detalhes** aos poucos e mantenha **Contraste da câmera** próximo de 100%. Se aparecer ruído ou contornos artificiais, reduza o realce. O efeito não recupera informação que a câmera não capturou.

Os valores confirmados ficam salvos no celular. A grade e o teste de um olho são temporários e não são restaurados quando o app é reaberto. **Voltar ao ambiente** encerra ambos os testes e libera os dois olhos. A grade suspende o arraste de painéis para evitar edições durante a calibração.

Em **Profundidade das janelas e restauração**, a separação virtual dos olhos altera a profundidade das janelas. **Restaurar alinhamento padrão** centraliza as imagens sem apagar o espaço ou os controles de câmera salvos.

Se até a grade de leitura estiver borrada em um olho isolado, o ajuste digital pode posicionar melhor a imagem, mas não altera a potência óptica da lente do VR Box. Se a grade estiver legível e o ambiente borrado, concentre o teste no foco da câmera e na iluminação.
