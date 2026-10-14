using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Events;

namespace MRPassthrough
{
    [Serializable]
    public class PCSystemStats
    {
        public string type;
        public int cpuUsage;
        public int memoryPercent;
        public int memoryUsedMB;
        public int memoryTotalMB;
        public string cpuModel;
        public int uptimeSeconds;
    }

    [Serializable]
    public class HologramNotification
    {
        public string type;
        public string title;
        public string message;
    }

    /// <summary>
    /// Gerencia a conexão WebSocket bidirecional entre o celular e o PC.
    /// Recebe dados do sistema (CPU/RAM/Mensagens) e envia gestos e telemetria.
    /// </summary>
    public class PCBridgeClient : MonoBehaviour
    {
        [Header("Configuração de Conexão")]
        [Tooltip("IP do seu computador na rede Wi-Fi local (ou 127.0.0.1 se usar cabo USB com adb reverse)")]
        public string pcIpAddress = "192.168.1.100";
        public int wsPort = 8080;
        [Tooltip("Token do link de pareamento exibido no painel local do PC") ]
        public string pairingToken = "";
        public bool autoConnectOnStart = true;

        [Header("Eventos")]
        public UnityEvent<PCSystemStats> OnStatsReceived;
        public UnityEvent<HologramNotification> OnNotificationReceived;
        public UnityEvent OnConnected;
        public UnityEvent OnDisconnected;

        private ClientWebSocket _webSocket;
        private CancellationTokenSource _cts;
        private readonly ConcurrentQueue<Action> _mainThreadQueue = new ConcurrentQueue<Action>();
        private bool _isConnected = false;

        public bool IsConnected => _isConnected;

        private void Start()
        {
            if (autoConnectOnStart)
            {
                ConnectToPC();
            }
        }

        private void Update()
        {
            // Processa mensagens recebidas na Thread principal do Unity
            while (_mainThreadQueue.TryDequeue(out var action))
            {
                action?.Invoke();
            }
        }

        public void ConnectToPC()
        {
            _cts = new CancellationTokenSource();
            _ = Task.Run(() => ConnectionLoop(_cts.Token));
        }

        private async Task ConnectionLoop(CancellationToken token)
        {
            string url = $"ws://{pcIpAddress}:{wsPort}?token={Uri.EscapeDataString(pairingToken)}";

            while (!token.IsCancellationRequested)
            {
                try
                {
                    _webSocket = new ClientWebSocket();
                    Debug.Log($"[PCBridge] Conectando a {pcIpAddress}:{wsPort}...");

                    await _webSocket.ConnectAsync(new Uri(url), token);

                    _isConnected = true;
                    _mainThreadQueue.Enqueue(() => OnConnected?.Invoke());
                    Debug.Log("[PCBridge] Conectado ao PC com sucesso!");

                    var buffer = new byte[8192];
                    while (_webSocket.State == WebSocketState.Open && !token.IsCancellationRequested)
                    {
                        var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", token);
                            break;
                        }

                        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        ProcessIncomingMessage(message);
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[PCBridge] Falha na conexão: {ex.Message}. Tentando novamente em 3s...");
                }
                finally
                {
                    _isConnected = false;
                    _mainThreadQueue.Enqueue(() => OnDisconnected?.Invoke());
                }

                // Aguarda 3 segundos antes de tentar reconectar
                await Task.Delay(3000, token);
            }
        }

        private void ProcessIncomingMessage(string json)
        {
            try
            {
                if (json.Contains("\"system_stats\""))
                {
                    var stats = JsonUtility.FromJson<PCSystemStats>(json);
                    _mainThreadQueue.Enqueue(() => OnStatsReceived?.Invoke(stats));
                }
                else if (json.Contains("\"hologram_notification\""))
                {
                    var notif = JsonUtility.FromJson<HologramNotification>(json);
                    _mainThreadQueue.Enqueue(() => OnNotificationReceived?.Invoke(notif));
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[PCBridge] Erro ao processar mensagem JSON: {ex.Message}");
            }
        }

        /// <summary>
        /// Envia evento de gesto para o computador (ex: pinça, clique, posição).
        /// </summary>
        public async void SendGesture(string gestureType, Vector2 screenPos, int count = 1)
        {
            if (_webSocket == null || _webSocket.State != WebSocketState.Open) return;

            try
            {
                string payload = $"{{\"type\":\"gesture_{gestureType}\",\"x\":{screenPos.x:F3},\"y\":{screenPos.y:F3},\"count\":{count},\"timestamp\":{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}}}";
                byte[] bytes = Encoding.UTF8.GetBytes(payload);
                await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[PCBridge] Erro ao enviar gesto: {ex.Message}");
            }
        }

        private void OnDestroy()
        {
            _cts?.Cancel();
            _webSocket?.Dispose();
        }
    }
}
