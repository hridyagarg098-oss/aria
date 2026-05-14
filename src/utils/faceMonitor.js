/**
 * Face Monitor — model loader helper.
 * Heavy detection logic lives inline in AptitudeTest.jsx.
 */
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
let _modelsLoaded = false;

export async function loadFaceModels(onProgress) {
  if (_modelsLoaded) return true;
  const faceapi = window.faceapi;
  if (!faceapi) return false;
  try {
    onProgress?.('Loading face detector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    onProgress?.('Loading landmark model...');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    _modelsLoaded = true;
    return true;
  } catch (err) {
    console.error('Face model load failed:', err);
    return false;
  }
}

export function areFaceModelsLoaded() { return _modelsLoaded; }

// Keep legacy exports so existing callers don't break
export function startFaceMonitoring() {}
export function stopFaceMonitoring() {}
export function startAudioMonitoring() {}
export function stopAudioMonitoring() {}
export function getCameraBorderColor() { return '#6b7280'; }
export function getCameraStatusText() { return ''; }
