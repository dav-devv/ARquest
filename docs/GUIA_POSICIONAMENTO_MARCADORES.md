# Guia de posicionamento dos marcadores ARquest

Este guia descreve o que o APK atual realmente usa. O marcador é a origem métrica do espaço; chão, mesas e paredes são detectados pelo ARCore. Os marcadores auxiliares não prendem janelas nem substituem a detecção de planos.

## Quantos marcadores usar

Para o APK atual, use **1 marcador ID 100** como origem fixa do cômodo. É suficiente para definir o sistema de coordenadas e relocalizar as janelas salvas quando o app for reaberto. Mais cópias do ID 100 não aumentam a precisão: se duas cópias iguais aparecem no mesmo quadro, o detector descarta aquela leitura para evitar ambiguidade.

Os IDs 101, 102 e 103 são **opcionais**. A folha inclui um de cada, com 70 mm, para identificar visualmente uma superfície horizontal voltada para cima (101), uma parede (102) e uma superfície horizontal voltada para baixo, como o teto (103). No APK atual, eles aparecem como etiquetas reconhecidas; não aumentam a precisão da origem nem fecham o contorno do mapa. Mantenha no máximo uma cópia de cada ID no campo de visão durante a leitura.

O app ainda não oferece múltiplas origens de cômodo. Para mapear outro espaço, não espalhe várias cópias do ID 100: a pose poderia ficar ambígua e as janelas pertencem ao mesmo mapa local salvo.

## Onde fixar o ID 100

- Prenda-o em uma parede rígida e imóvel, aproximadamente na altura dos olhos (por volta de 1,2 a 1,6 m), perto do local em que você normalmente começa a usar o AR.
- Escolha uma posição que a câmera consiga ver inteira ao iniciar e a partir de mais de um ângulo. Deixe espaço livre ao redor para a borda não se confundir com objetos.
- Evite portas, janelas móveis, vidro, superfícies brilhantes, papel que possa dobrar e locais que serão cobertos por móveis ou pessoas.
- Mantenha a folha plana, com bom contraste e iluminação uniforme. Evite reflexo direto, sombra forte, desfoque e impressão danificada.
- Não mova o marcador depois de definir a origem. As poses das janelas são guardadas em relação à posição e orientação dele; movê-lo também desloca o mapa restaurado.

A folha padrão usa o quadrado preto externo do ID 100 com **100 mm de lado**. Imprima em A4 a 100%, desative “ajustar à página” e confira com régua a linha de 100 mm e o lado preto. Informe no app a medida real do quadrado preto, sem contar a margem branca. Se estiver usando uma folha antiga de outro tamanho, informe o tamanho medido em vez de presumir 100 mm.

## Como ler e mapear o ambiente

1. Abra o AR em um lugar iluminado e com detalhes visuais no ambiente. Toque em **Referência** e enquadre o ID 100 inteiro, de frente, por alguns instantes.
2. Aproxime o celular até o código ficar nítido. Como referência técnica, o detector rejeita leituras com lados menores que cerca de 28 pixels na imagem; procure deixar cada lado com pelo menos 50 pixels quando possível. Com a folha de 100 mm, começar a cerca de 0,5–1,5 m costuma ser prático, mas a distância real depende da câmera e da luz.
3. Depois de localizar o ID 100, toque em **Mapear ambiente**. Mova o celular devagar: primeiro percorra o chão e mesas; depois aponte para as paredes de diferentes ângulos. Mantenha áreas consecutivas sobrepostas no campo da câmera.
4. Aguarde o app registrar as superfícies e as amostras de profundidade. Quando estas concordam com um plano, o app ajusta levemente a posição do plano e salva o suporte de profundidade. Corrija a posição se houver uma área importante sem leitura; toque em **Concluir mapeamento** para terminar. O mapa fica salvo em coordenadas relativas ao ID 100.
5. Para criar janelas, mire em uma superfície detectada e toque em **Criar na superfície**. Aguarde a confirmação de estabilidade; a janela só é gravada depois que o mesmo plano permanece consistente por alguns quadros. Ela recebe sua própria âncora na superfície, independente do marcador.
6. Ao reabrir o app ou perder a referência, mostre novamente o mesmo ID 100 para relocalizar a origem e restaurar as posições salvas.

O movimento deve ser contínuo e lento, sem girar o celular bruscamente. Paredes lisas, escuras, reflexivas ou com pouca luz podem ser difíceis para o ARCore; mova o aparelho para que a câmera veja detalhes e perspectivas diferentes. O número de quadrados impressos não compensa uma superfície sem textura nem substitui uma boa varredura.

## Posicionamento opcional das etiquetas 101–103

Se quiser usar as etiquetas da segunda página da folha, fixe apenas a etiqueta apropriada perto da área correspondente, mantendo o quadrado inteiro, plano e visível:

- **ID 101 — horizontal para cima:** no chão ou próximo à mesa/bancada horizontal.
- **ID 102 — vertical:** na parede.
- **ID 103 — horizontal para baixo:** no teto ou na face inferior de uma superfície.

Elas são auxiliares de orientação no diagnóstico. O contorno vem do plano detectado pelo ARCore. As amostras de profundidade validam os pontos do plano e podem corrigir sua posição em até 3 cm; se a profundidade estiver indisponível ou não concordar com o plano, a geometria do ARCore é mantida. Isso não equivale a uma malha 3D densa. Nenhum desses três IDs é necessário para posicionar janelas.

## Confiança e gestos das janelas

O ID 100 é avaliado pelo erro de reprojeção dos quatro cantos e pelo tamanho e equilíbrio dos lados na imagem. A pose exibida combina leituras de até oito quadros; são necessárias seis observações consistentes para habilitar a referência. A confiança é uma estimativa relativa de qualidade, não uma garantia de precisão em milímetros. Se estiver baixa, aproxime o celular, melhore a luz e mantenha o marcador inteiro e imóvel.

Com o rastreamento de mãos ligado, faça pinça em um dos quatro cantos destacados da janela. Mantenha a pinça, mova a mão até outra superfície que o ARCore reconheça e solte para salvar. Duas pinças na mesma janela continuam controlando o tamanho.

## Resumo recomendado

**Mínimo e recomendado para o APK atual: 1 × ID 100 fixo.** Use os IDs 101–103 apenas se as etiquetas de orientação forem úteis. Para melhorar a leitura, priorize marcador sem movimento, tamanho correto, boa iluminação, enquadramento inteiro e uma varredura lenta com diferentes ângulos.
