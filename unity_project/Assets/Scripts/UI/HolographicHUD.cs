using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace MRPassthrough
{
    /// <summary>
    /// Painel holográfico flutuante no espaço que exibe telemetria do PC
    /// e reage a interações das mãos.
    /// </summary>
    public class HolographicHUD : MonoBehaviour
    {
        [Header("Referências de UI")]
        public TextMeshProUGUI titleText;
        public TextMeshProUGUI cpuText;
        public Image cpuProgressBar;
        public TextMeshProUGUI ramText;
        public Image ramProgressBar;
        public TextMeshProUGUI notificationText;
        public Image panelBackground;

        [Header("Comportamento Espacial")]
        [Tooltip("Suavemente segue a cabeça do usuário ou fica fixo no espaço")]
        public bool followHead = true;
        public float followSpeed = 3.0f;
        public float distanceFromCamera = 1.2f;

        private Transform _mainCameraTransform;

        private void Start()
        {
            if (Camera.main != null)
            {
                _mainCameraTransform = Camera.main.transform;
            }
        }

        private void LateUpdate()
        {
            if (followHead && _mainCameraTransform != null)
            {
                Vector3 targetPosition = _mainCameraTransform.position + (_mainCameraTransform.forward * distanceFromCamera);
                transform.position = Vector3.Lerp(transform.position, targetPosition, Time.deltaTime * followSpeed);
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(transform.position - _mainCameraTransform.position), Time.deltaTime * followSpeed);
            }
        }

        /// <summary>
        /// Fixa a tela holográfica permanentemente no ponto do ambiente físico onde ela está.
        /// </summary>
        public void PinInWorldSpace()
        {
            followHead = false;
        }

        /// <summary>
        /// Faz a tela voltar a seguir o olhar suavemente.
        /// </summary>
        public void UnpinFollowHead()
        {
            followHead = true;
        }

        public void UpdateStats(PCSystemStats stats)
        {
            if (stats == null) return;

            if (cpuText != null) cpuText.text = $"CPU: {stats.cpuUsage}%";
            if (cpuProgressBar != null) cpuProgressBar.fillAmount = stats.cpuUsage / 100f;

            if (ramText != null) ramText.text = $"RAM: {stats.memoryPercent}% ({stats.memoryUsedMB}MB)";
            if (ramProgressBar != null) ramProgressBar.fillAmount = stats.memoryPercent / 100f;
        }

        public void ShowNotification(HologramNotification notif)
        {
            if (notificationText != null && notif != null)
            {
                notificationText.text = $"{notif.title}: {notif.message}";
            }
        }

        public void SetHoloColor(Color color)
        {
            if (panelBackground != null)
            {
                panelBackground.color = color;
            }
        }
    }
}
