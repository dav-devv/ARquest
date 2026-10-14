using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace MRPassthrough
{
    /// <summary>
    /// Gerencia a captura da câmera traseira do celular e projeta como fundo
    /// estereoscópico para óculos VR (Cardboard / VR Box).
    /// </summary>
    public class WebCamPassthrough : MonoBehaviour
    {
        [Header("Renderização Estereoscópica")]
        [Tooltip("RawImage ou Material do olho esquerdo")]
        public RawImage leftEyeBackground;

        [Tooltip("RawImage ou Material do olho direito")]
        public RawImage rightEyeBackground;

        [Header("Configurações da Câmera")]
        public int requestedWidth = 1280;
        public int requestedHeight = 720;
        public int requestedFPS = 60;

        private WebCamTexture _webCamTexture;
        private WebCamDevice[] _devices;

        private void Start()
        {
            StartCoroutine(InitializeCameraCoroutine());
        }

        private IEnumerator InitializeCameraCoroutine()
        {
            // Solicita permissão de câmera no Android/iOS
            yield return Application.RequestUserAuthorization(UserAuthorization.WebCam);

            if (!Application.HasUserAuthorization(UserAuthorization.WebCam))
            {
                Debug.LogError("[Passthrough] Permissão de câmera negada pelo usuário.");
                yield break;
            }

            _devices = WebCamTexture.devices;
            if (_devices.Length == 0)
            {
                Debug.LogWarning("[Passthrough] Nenhuma câmera encontrada no dispositivo.");
                yield break;
            }

            // Seleciona preferencialmente a câmera traseira (environment)
            string selectedDeviceName = _devices[0].name;
            foreach (var device in _devices)
            {
                if (!device.isFrontFacing)
                {
                    selectedDeviceName = device.name;
                    break;
                }
            }

            Debug.Log($"[Passthrough] Inicializando câmera: {selectedDeviceName} a {requestedWidth}x{requestedHeight} @ {requestedFPS}fps");

            _webCamTexture = new WebCamTexture(selectedDeviceName, requestedWidth, requestedHeight, requestedFPS);

            if (leftEyeBackground != null) leftEyeBackground.texture = _webCamTexture;
            if (rightEyeBackground != null) rightEyeBackground.texture = _webCamTexture;

            _webCamTexture.Play();

            // Aguarda o início da transmissão para ajustar rotação e escala
            yield return new WaitUntil(() => _webCamTexture.width > 16);

            AdjustOrientation();
        }

        private void AdjustOrientation()
        {
            if (_webCamTexture == null) return;

            // Corrige a rotação do sensor da câmera do Android se necessário
            int videoRotationAngle = _webCamTexture.videoRotationAngle;
            bool videoVerticallyMirrored = _webCamTexture.videoVerticallyMirrored;

            if (leftEyeBackground != null)
            {
                leftEyeBackground.rectTransform.localEulerAngles = new Vector3(0, 0, -videoRotationAngle);
                if (videoVerticallyMirrored)
                {
                    leftEyeBackground.uvRect = new Rect(0, 1, 1, -1);
                }
            }

            if (rightEyeBackground != null)
            {
                rightEyeBackground.rectTransform.localEulerAngles = new Vector3(0, 0, -videoRotationAngle);
                if (videoVerticallyMirrored)
                {
                    rightEyeBackground.uvRect = new Rect(0, 1, 1, -1);
                }
            }
        }

        private void OnDestroy()
        {
            if (_webCamTexture != null && _webCamTexture.isPlaying)
            {
                _webCamTexture.Stop();
            }
        }
    }
}
