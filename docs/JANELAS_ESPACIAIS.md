# Janelas espaciais e interação por mãos — 0.13

O APK nativo desenha painéis com cantos arredondados, barra de pegar abaixo da superfície e destaque de seleção. O botão X fecha o painel com uma pinça curta e soltura sobre o próprio botão. Os controles do PC continuam disponíveis.

## Como usar

1. Mostre a mão aberta antes de iniciar a pinça. Isso arma a interação e evita selecionar uma janela ao reaparecer com os dedos já fechados.
2. Faça pinça na barra inferior ou na superfície do painel e mova a mão. A janela permanece capturada pela mesma mão, mesmo quando o indicador sai da sua borda. Solte para fixar e salvar.
3. Faça duas pinças sobre o mesmo painel e afaste/aproxime as mãos para dimensionar. Depois de começar, as duas mãos continuam associadas ao painel até soltar. O cálculo usa interseções no plano da janela. Se o celular se mover, o tamanho pausa e a base é refeita após um curto período estável; depois continue o gesto. Isso evita usar o aumento aparente dos dedos como comando de tamanho.
4. Um pequeno círculo indica o ponto de interação, inclusive nas duas lentes. O círculo diminui quando a pinça é reconhecida.

O arraste mantém o plano e a profundidade do ponto inicial, evitando saltos ao atravessar uma parede ou mesa detectada. Não mede a profundidade real dos dedos com uma única câmera. Para criar a janela inicial, continua sendo necessário localizar o espaço e confirmar uma superfície estável.

## Estabilidade

- Identidade temporal por mão, independente da ordem e da classificação esquerda/direita de cada leitura do MediaPipe.
- Filtro adaptativo dos pontos e pinça com limiares distintos de fechamento/abertura. Uma leitura repetida pelo renderizador não conta como novas solturas.
- Perdas breves congelam a interação; a retenção tem prazo e não inventa movimento. Após perda prolongada, a interação termina. Recuperar a câmera não usa uma trajetória antiga para mover um painel.
- Suavização de pequenas oscilações das âncoras no sistema de coordenadas da origem, quando disponível. O desenho olha para a posição do observador, mantendo o eixo vertical do ambiente em vez de copiar a rotação do celular.
- A origem salva aguarda as leituras consistentes do ID 100 antes de restaurar as janelas. O cálculo de apoio da profundidade usa o polígono local X/Z e a normal Y do plano ARCore.
- Cada observação da mão guarda a pose óptica, os intrínsecos e o timestamp da imagem que a produziu. O raio de interação usa o indicador bruto dessa mesma imagem, e o movimento é suavizado depois de convertido para o mundo. O esqueleto 2D continua sendo uma indicação da última imagem processada.
- A lista, os tamanhos e as poses relativas conhecidas ficam salvos mesmo quando a origem está temporariamente indisponível; uma janela excluída não reaparece ao reabrir o app. Redefinir a referência transforma as superfícies salvas para o novo sistema sem mudar sua posição física na sessão.
- **Sair do AR** no computador permanece disponível se o renderizador falhar. Abra o AR novamente pelo PC para recriar a tela. Ao pausar o app, interações incompletas são encerradas e os dados do espaço são gravados.

As alças e a barra seguem a referência de affordances dos [painéis do Meta Horizon OS](https://developers.meta.com/vr/design/panels/); a implementação permanece nativa do ARquest.

## Validação e limites

Testes JVM cobrem associação de mãos, ruído sintético, retenção/soltura, captura por identidade, interseção raio/plano, orientação e geometria de profundidade. Eles não medem a precisão real do MediaPipe, o drift do ARCore ou o FPS no visor. Esses pontos precisam de teste com o celular em movimento, iluminação adequada e mãos dentro da imagem.

Rode `apps/android/test-core.ps1` para os testes puros. Com SDK e AARs já obtidos pelo build, `apps/android/test-hands-capture.ps1` verifica a correspondência das capturas e `apps/android/test-workspace.ps1` verifica o rebase usando a classe Pose do ARCore. Nenhum desses testes exige instalar um pacote de instrumentação no celular.
