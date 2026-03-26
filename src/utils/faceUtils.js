import * as faceapi from '@vladmandic/face-api';

// ─── Configuration ────────────────────────────────────────────────────────────
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.6;   // Euclidean distance; lower = stricter

let modelsLoaded = false;
let modelsLoading = false;
let loadListeners = [];

// ─── Model Loading ────────────────────────────────────────────────────────────

/**
 * Loads all required face-api.js models.
 * Safe to call multiple times – loads only once.
 * @param {function} onProgress  optional callback(pct: number)
 */
export const loadModels = async (onProgress) => {
  if (modelsLoaded) return true;

  if (modelsLoading) {
    // Queue up callers while loading
    return new Promise((resolve, reject) => {
      loadListeners.push({ resolve, reject });
    });
  }

  modelsLoading = true;

  try {
    onProgress?.(10);
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);

    onProgress?.(40);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);

    onProgress?.(70);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);

    onProgress?.(100);
    modelsLoaded = true;
    modelsLoading = false;
    loadListeners.forEach(l => l.resolve(true));
    loadListeners = [];
    return true;
  } catch (err) {
    modelsLoading = false;
    loadListeners.forEach(l => l.reject(err));
    loadListeners = [];
    throw err;
  }
};

export const areModelsLoaded = () => modelsLoaded;

// ─── Detection Options ────────────────────────────────────────────────────────

const getDetectorOptions = () =>
  new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

// ─── Capture Single Descriptor ────────────────────────────────────────────────

/**
 * Captures a face descriptor from a video element.
 * @param {HTMLVideoElement} video
 * @returns {Float32Array|null} 128-dim descriptor or null if no face found
 */
export const captureFaceDescriptor = async (video) => {
  if (!modelsLoaded) throw new Error('Models not loaded yet.');

  const detection = await faceapi
    .detectSingleFace(video, getDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? detection.descriptor : null;
};

// ─── Real-time Detection (multiple faces) ────────────────────────────────────

/**
 * Runs detection on a single frame of a video element.
 * @param {HTMLVideoElement} video
 * @returns {faceapi.WithFaceDescriptor[]} array of detections with descriptors
 */
export const detectFaces = async (video) => {
  if (!modelsLoaded) return [];

  const detections = await faceapi
    .detectAllFaces(video, getDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections;
};

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Builds a FaceMatcher from stored user records.
 * @param {object[]} registeredUsers  list from storageUtils.getRegisteredFaces()
 * @returns {faceapi.FaceMatcher|null}
 */
export const buildFaceMatcher = (registeredUsers) => {
  if (!registeredUsers || registeredUsers.length === 0) return null;

  const labeledDescriptors = registeredUsers.map(user => {
    const descriptors = [new Float32Array(user.descriptor)];
    return new faceapi.LabeledFaceDescriptors(user.id, descriptors);
  });

  return new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
};

/**
 * Matches a single descriptor against the matcher.
 * @param {faceapi.FaceMatcher} matcher
 * @param {Float32Array} descriptor
 * @returns {{ label: string, distance: number }}
 */
export const matchFace = (matcher, descriptor) => {
  if (!matcher) return { label: 'unknown', distance: 1 };
  const result = matcher.findBestMatch(descriptor);
  return { label: result.label, distance: result.distance };
};

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

/**
 * Resizes detection results to the display size of the video element,
 * then draws bounding boxes + labels onto a canvas overlay.
 *
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas
 * @param {Array} detections        raw detections with descriptors
 * @param {object[]} registeredUsers
 * @param {faceapi.FaceMatcher|null} matcher
 * @returns {object[]}              array of { userId, name, distance, status }
 */
export const drawDetections = (video, canvas, detections, registeredUsers, matcher) => {
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const resized = faceapi.resizeResults(detections, displaySize);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const results = [];

  resized.forEach(detection => {
    const { x, y, width, height } = detection.detection.box;
    let label = 'Unknown';
    let color = '#ef4444';   // red for unknown
    let userId = null;
    let distance = 1;

    if (matcher && detection.descriptor) {
      const match = matchFace(matcher, detection.descriptor);
      if (match.label !== 'unknown') {
        const user = registeredUsers.find(u => u.id === match.label);
        if (user) {
          label = user.name;
          userId = user.id;
          distance = match.distance;
          color = '#22c55e';   // green for recognized
        }
      }
    }

    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.strokeRect(x, y, width, height);

    // Corner accents
    const cornerLen = Math.min(width, height) * 0.15;
    ctx.lineWidth = 3;
    // TL
    ctx.beginPath(); ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(x + width - cornerLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cornerLen); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(x, y + height - cornerLen); ctx.lineTo(x, y + height); ctx.lineTo(x + cornerLen, y + height); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(x + width - cornerLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cornerLen); ctx.stroke();

    // Label background
    const labelText = userId ? `${label} (${(1 - distance).toFixed(0) === '1' ? '100' : ((1 - distance) * 100).toFixed(0)}%)` : label;
    ctx.font = 'bold 13px Inter, sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    const labelH = 24;
    const labelY = y > labelH + 4 ? y - labelH - 4 : y + height + 4;

    ctx.shadowBlur = 0;
    ctx.fillStyle = color + 'cc';
    ctx.beginPath();
    ctx.roundRect(x, labelY, textWidth + 16, labelH, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.fillText(labelText, x + 8, labelY + 16);
    ctx.shadowBlur = 0;

    results.push({
      userId,
      name: label,
      distance,
      status: userId ? 'recognized' : 'unknown',
      department: userId ? registeredUsers.find(u => u.id === userId)?.department : null,
    });
  });

  return results;
};

// ─── Webcam Helpers ───────────────────────────────────────────────────────────

/**
 * Requests webcam access and assigns the stream to the given video element.
 * @param {HTMLVideoElement} videoEl
 * @param {string} facingMode  'user' or 'environment'
 * @returns {MediaStream}
 */
export const startWebcam = async (videoEl, facingMode = 'user') => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: facingMode
    },
    audio: false,
  });
  videoEl.srcObject = stream;
  await new Promise(resolve => { videoEl.onloadedmetadata = resolve; });
  await videoEl.play();
  return stream;
};

/**
 * Stops all tracks on a MediaStream.
 * @param {MediaStream} stream
 */
export const stopWebcam = (stream) => {
  if (stream) stream.getTracks().forEach(t => t.stop());
};
