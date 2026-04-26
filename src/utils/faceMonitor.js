/**
 * Face Monitor — Anti-cheat face detection using face-api.js (loaded via CDN)
 */
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

let modelsLoaded = false;
let detectionInterval = null;
let audioCtx = null;
let audioAnalyser = null;

export async function loadFaceModels() {
  if (modelsLoaded) return true;
  const faceapi = window.faceapi;
  if (!faceapi) {
    console.warn('face-api.js not yet loaded from CDN, will retry...');
    return false;
  }
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    return true;
  } catch (err) {
    console.error('Failed to load face models:', err);
    return false;
  }
}

/**
 * Analyze a video element for face presence/gaze/lips
 * Returns { status, violations[] }
 * status: 'ok' | 'no_face' | 'multiple_faces' | 'looking_away' | 'lip_movement' | 'error'
 */
export async function detectFace(videoEl) {
  const faceapi = window.faceapi;
  if (!faceapi || !modelsLoaded || !videoEl) {
    return { status: 'error', violations: [] };
  }

  try {
    const detections = await faceapi
      .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceLandmarks();

    if (detections.length === 0) {
      return { status: 'no_face', violations: [{ type: 'no_face', ts: Date.now(), detail: 'No face detected in camera feed' }] };
    }

    if (detections.length > 1) {
      return { status: 'multiple_faces', violations: [{ type: 'multiple_faces', ts: Date.now(), detail: `${detections.length} faces detected` }] };
    }

    const landmarks = detections[0].landmarks;
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const mouth = landmarks.getMouth();

    // Gaze check: nose tip should be roughly centered between eyes
    const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
    const noseTipX = nose[3].x;
    const gazeDeviation = Math.abs(noseTipX - eyeCenterX);
    const faceWidth = Math.abs(rightEye[3].x - leftEye[0].x);

    if (gazeDeviation > faceWidth * 0.6) {
      return { status: 'looking_away', violations: [{ type: 'looking_away', ts: Date.now(), detail: `Gaze deviation: ${gazeDeviation.toFixed(1)}px` }] };
    }

    // Lip movement check (mouth openness)
    const upperLip = mouth[3];
    const lowerLip = mouth[9];
    const mouthOpen = Math.abs(lowerLip.y - upperLip.y);
    const mouthWidth = Math.abs(mouth[6].x - mouth[0].x);
    const mouthRatio = mouthOpen / mouthWidth;

    if (mouthRatio > 0.35) {
      return { status: 'lip_movement', violations: [{ type: 'lip_movement', ts: Date.now(), detail: `Mouth ratio: ${mouthRatio.toFixed(2)}` }] };
    }

    return { status: 'ok', violations: [] };
  } catch (err) {
    return { status: 'error', violations: [] };
  }
}

/**
 * Start face monitoring loop
 * @param {HTMLVideoElement} videoEl
 * @param {Function} onViolation - called with { type, ts, detail }
 * @param {number} intervalMs - default 1500ms
 */
export function startFaceMonitoring(videoEl, onViolation, intervalMs = 1500) {
  stopFaceMonitoring();
  detectionInterval = setInterval(async () => {
    const result = await detectFace(videoEl);
    if (result.violations.length > 0) {
      result.violations.forEach(v => onViolation(v));
    }
  }, intervalMs);
}

export function stopFaceMonitoring() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
}

/**
 * Start ambient audio monitoring
 * @param {MediaStream} stream
 * @param {Function} onLoudAudio - called when ambient sound exceeds threshold
 * @param {number} threshold - 0-255, default 80
 */
export function startAudioMonitoring(stream, onLoudAudio, threshold = 110) {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyser.fftSize = 256;
    source.connect(audioAnalyser);

    let lastReport = 0;
    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    const check = () => {
      if (!audioAnalyser) return;
      audioAnalyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      // Only report max once every 10 seconds to avoid DB flood
      if (avg > threshold && Date.now() - lastReport > 10000) {
        lastReport = Date.now();
        onLoudAudio({ type: 'loud_audio', ts: Date.now(), detail: `Audio level: ${avg.toFixed(0)}` });
      }
      if (audioAnalyser) requestAnimationFrame(check);
    };
    check();
  } catch (err) {
    console.error('Audio monitoring failed:', err);
  }
}

export function stopAudioMonitoring() {
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
    audioAnalyser = null;
  }
}

/**
 * Get camera border color based on status
 */
export function getCameraBorderColor(status) {
  switch (status) {
    case 'ok': return '#22c55e';
    case 'no_face':
    case 'looking_away':
    case 'lip_movement': return '#f59e0b';
    case 'multiple_faces': return '#ef4444';
    case 'error': return '#6b7280';
    default: return '#6b7280';
  }
}

export function getCameraStatusText(status) {
  switch (status) {
    case 'ok': return '✓ Face Detected';
    case 'no_face': return '⚠ No Face';
    case 'looking_away': return '⚠ Look at Screen';
    case 'lip_movement': return '⚠ No Talking';
    case 'multiple_faces': return '✗ Multiple Faces';
    case 'error': return '— Loading...';
    default: return '— Initializing';
  }
}
