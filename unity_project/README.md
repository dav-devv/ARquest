# 👓 MR Passthrough & Hand Tracking - Projeto Unity

Este projeto implementa uma solução de **Realidade Mista (MR)** para smartphones acoplados a óculos VR genéricos (VR Box, Google Cardboard), incluindo:
1. **Video Passthrough Estereoscópico:** Projeta o feed da câmera traseira do celular para ambos os olhos (SBS).
2. **Hand Tracking com Gestos:** Rastreia os 21 pontos esqueléticos das mãos e detecta gestos de pinça (Pinch).
3. **Ponte PC <-> Celular:** Conexão em tempo real via WebSocket para exibir dados do computador no headset e enviar comandos/gestos do headset para o PC.

---

## 🛠️ Como Abrir no Unity

1. Abra o **Unity Hub**.
2. Clique em **Add** (Adicionar projeto a partir do disco) e selecione a pasta:
   ```
   C:\Users\david\.gemini\antigravity\scratch\mr_passthrough_companion\unity_project
   ```
3. Recomendamos a versão **Unity 2022.3 LTS** ou **Unity 6 LTS**.

---

## ⚙️ Configurações Importantes no Unity

### 1. XR Plugin Management (Google Cardboard)
* Vá em **Edit > Project Settings > XR Plug-in Management**.
* Na aba **Android**, marque a caixa **Cardboard XR Plugin**.

### 2. Player Settings (Android)
* Vá em **Edit > Project Settings > Player > Android Settings**:
  * **Color Space:** Linear
  * **Auto Graphics API:** Desmarque e garanta que **OpenGLES3** ou **Vulkan** esteja na lista.
  * **Minimum API Level:** Android 8.0 (API Level 26) ou superior.
  * **Target API Level:** Automático / Mais recente.
  * **Scripting Backend:** IL2CPP (ou Mono durante testes rápidos).
  * **Target Architectures:** ARM64.

---

## 🚀 Montagem da Cena

1. **Câmera VR:**
   * Adicione o `Tracked Pose Driver` na Main Camera para rastrear a rotação da cabeça via giroscópio.
2. **Passthrough:**
   * Crie um Canvas com Render Mode *Screen Space - Camera* ou adicione dois Quads posicionados no fundo de cada olho.
   * Adicione o componente `WebCamPassthrough.cs` e associe as referências dos olhos.
3. **Ponte com o PC (`PCBridgeClient.cs`):**
   * Adicione o script `PCBridgeClient.cs` em um GameObject vazio.
   * Coloque o IP do seu computador na variável `pcIpAddress` (ou `127.0.0.1` se usar cabo USB).
4. **Holograma Flutuante (`HolographicHUD.cs`):**
   * Conecte o evento `OnStatsReceived` do `PCBridgeClient` para chamar `HolographicHUD.UpdateStats`.
5. **Rastreamento de Mãos (`HandTrackingManager.cs`):**
   * Adicione o script na cena para receber os 21 pontos e disparar o evento de pinça.

---

## 🔌 Conexão Celular <-> PC

### Modo 1: Wi-Fi Local (Mesma Rede)
* No script `PCBridgeClient`, insira o IP local do seu computador (ex: `192.168.1.15`).

### Modo 2: Cabo USB com ADB (Latência Zero / Recomendado)
* Conecte o celular via USB e ative a Depuração USB.
* No terminal do computador, execute:
  ```bash
  adb reverse tcp:8080 tcp:8080
  ```
* No Unity, deixe o IP como `127.0.0.1`.
