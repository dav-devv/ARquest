using System;
using UnityEngine;
using UnityEngine.Events;

namespace MRPassthrough
{
    [Serializable]
    public class HandLandmark
    {
        public Vector3 position;
        public float visibility;
    }

    /// <summary>
    /// Gerencia o esqueleto 3D da mão rastreada e a detecção de gestos (Pinça/Pinch).
    /// </summary>
    public class HandTrackingManager : MonoBehaviour
    {
        [Header("Visualização dos Ossos e Articulações")]
        public GameObject jointPrefab;
        public LineRenderer boneLineRenderer;
        public Transform trackingOrigin;

        [Header("Parâmetros do Gesto de Pinça (Pinch)")]
        [Tooltip("Distância máxima entre o polegar e o indicador para considerar pinça (em metros)")]
        public float pinchThreshold = 0.04f;
        public float pinchReleaseThreshold = 0.055f;

        [Header("Eventos de Interação")]
        public UnityEvent<Vector3> OnPinchStarted;
        public UnityEvent<Vector3> OnPinchStay;
        public UnityEvent OnPinchEnded;

        [Header("Conexão com PC (Opcional)")]
        public PCBridgeClient pcBridge;

        private GameObject[] _joints = new GameObject[21];
        private bool _isPinching = false;
        private int _pinchCount = 0;

        // Conexões esqueléticas padrão do MediaPipe
        private readonly (int from, int to)[] _connections = new[]
        {
            (0,1), (1,2), (2,3), (3,4),       // Polegar
            (0,5), (5,6), (6,7), (7,8),       // Indicador
            (5,9), (9,10), (10,11), (11,12),  // Médio
            (9,13), (13,14), (14,15), (15,16),// Anelar
            (13,17), (17,18), (18,19), (19,20),// Mindinho
            (0,17)                            // Base
        };

        private void Awake()
        {
            InitializeJointVisuals();
        }

        private void InitializeJointVisuals()
        {
            if (jointPrefab == null) return;

            Transform parent = trackingOrigin != null ? trackingOrigin : transform;
            for (int i = 0; i < 21; i++)
            {
                _joints[i] = Instantiate(jointPrefab, parent);
                _joints[i].name = $"HandJoint_{i}";
                _joints[i].SetActive(false);
            }
        }

        /// <summary>
        /// Atualiza os 21 pontos da mão a partir dos dados do detector (MediaPipe ou Sentis).
        /// </summary>
        public void UpdateHandLandmarks(Vector3[] worldPositions)
        {
            if (worldPositions == null || worldPositions.Length < 21) return;

            for (int i = 0; i < 21; i++)
            {
                if (_joints[i] != null)
                {
                    _joints[i].SetActive(true);
                    _joints[i].transform.position = worldPositions[i];
                }
            }

            CheckPinchGesture(worldPositions[4], worldPositions[8]);
        }

        private void CheckPinchGesture(Vector3 thumbTip, Vector3 indexTip)
        {
            float distance = Vector3.Distance(thumbTip, indexTip);
            Vector3 pinchMidpoint = (thumbTip + indexTip) * 0.5f;

            if (!_isPinching && distance < pinchThreshold)
            {
                _isPinching = true;
                _pinchCount++;
                OnPinchStarted?.Invoke(pinchMidpoint);

                if (pcBridge != null && pcBridge.IsConnected)
                {
                    Vector2 screenPos = Camera.main != null ? Camera.main.WorldToViewportPoint(pinchMidpoint) : Vector2.zero;
                    pcBridge.SendGesture("pinch", screenPos, _pinchCount);
                }
            }
            else if (_isPinching && distance > pinchReleaseThreshold)
            {
                _isPinching = false;
                OnPinchEnded?.Invoke();
            }
            else if (_isPinching)
            {
                OnPinchStay?.Invoke(pinchMidpoint);
            }
        }

        public bool IsPinching => _isPinching;
    }
}
