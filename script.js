/*
ESCANEO — Detección 100% en el navegador con ONNX Runtime Web
================================================================
No necesita backend. Todo corre en el cliente.

En tu index.html, ANTES de esta línea <script src="script.js">,
agrega:
  <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
*/
const RUTA_MODELO = "https://huggingface.co/eliii03/Objeto/resolve/main/modelo_v2_convertido.onnx";
const TAMANO_ENTRADA = 416;
const NOMBRES_CLASES = [
  "Backpack", "Bed", "Bottle", "Chair", "Couch", "Door", "Fork", "Glass",
  "Hat", "Jug", "Knife", "Lamp", "Mirror", "Mug", "Oven", "Plate",
  "Spoon", "Table", "Television", "Wok",
];
const UMBRAL_CONFIANZA = 0.55;
const IOU_NMS = 0.3;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const estado = document.getElementById("estado");

const captura = document.createElement("canvas");
captura.width = TAMANO_ENTRADA;
captura.height = TAMANO_ENTRADA;
const capturaCtx = captura.getContext("2d");

let sesion = null;

// ---------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------
async function iniciarCamara() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    estado.innerHTML = "Cámara activa";
  } catch (e) {
    console.error(e);
    estado.innerHTML = "No se pudo abrir cámara";
  }
}

// ---------------------------------------------------------------
// Cargar el modelo ONNX (una sola vez, desde Hugging Face)
// ---------------------------------------------------------------
async function cargarModelo() {
  estado.innerHTML = "Cargando modelo...";
  sesion = await ort.InferenceSession.create(RUTA_MODELO, {
    executionProviders: ["wasm"],
  });
  console.log("Nombres de salida del modelo:", sesion.outputNames);
  estado.innerHTML = "Modelo listo";
}

// ---------------------------------------------------------------
// Preprocesar: letterbox (mantener proporción) + normalizar
// ---------------------------------------------------------------
function preprocesar() {
  const anchoOriginal = video.videoWidth;
  const altoOriginal = video.videoHeight;

  const escala = Math.min(TAMANO_ENTRADA / anchoOriginal, TAMANO_ENTRADA / altoOriginal);
  const anchoNuevo = Math.round(anchoOriginal * escala);
  const altoNuevo = Math.round(altoOriginal * escala);

  capturaCtx.fillStyle = "black";
  capturaCtx.fillRect(0, 0, TAMANO_ENTRADA, TAMANO_ENTRADA);
  capturaCtx.drawImage(video, 0, 0, anchoNuevo, altoNuevo);

  const imgData = capturaCtx.getImageData(0, 0, TAMANO_ENTRADA, TAMANO_ENTRADA);
  const { data } = imgData;

  // RGBA -> RGB, normalizado /255/255 (mismo doble-escalado que el
  // entrenamiento: dividieron entre 255 manual + backbone con
  // include_rescaling=True que divide entre 255 otra vez)
  const floatData = new Float32Array(TAMANO_ENTRADA * TAMANO_ENTRADA * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    floatData[j] = (data[i] / 255) / 255;
    floatData[j + 1] = (data[i + 1] / 255) / 255;
    floatData[j + 2] = (data[i + 2] / 255) / 255;
  }

  return {
    tensor: new ort.Tensor("float32", floatData, [1, TAMANO_ENTRADA, TAMANO_ENTRADA, 3]),
    escala,
  };
}

// ---------------------------------------------------------------
// NMS manual (reemplaza el prediction_decoder de Keras-CV, que no
// se exportó a ONNX). IoU estándar por clase.
// ---------------------------------------------------------------
function iou(a, b) {
  const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

function nms(cajas, confianzas, clases) {
  const indices = confianzas
    .map((c, i) => i)
    .filter((i) => confianzas[i] >= UMBRAL_CONFIANZA)
    .sort((a, b) => confianzas[b] - confianzas[a]);

  const mantenidos = [];
  const usados = new Set();

  for (const i of indices) {
    if (usados.has(i)) continue;
    mantenidos.push(i);
    for (const j of indices) {
      if (j === i || usados.has(j)) continue;
      if (clases[i] === clases[j] && iou(cajas[i], cajas[j]) > IOU_NMS) {
        usados.add(j);
      }
    }
  }
  return mantenidos;
}

// ---------------------------------------------------------------
// Correr un ciclo de inferencia
// ---------------------------------------------------------------
async function detectar() {
  const { tensor, escala } = preprocesar();

  const nombreEntrada = sesion.inputNames[0];
  const salida = await sesion.run({ [nombreEntrada]: tensor });

  // Si ves errores o resultados sin sentido, revisa en la consola:
  // console.log(sesion.outputNames) — puede que el orden real de las
  // salidas no coincida con [0]=boxes, [1]=scores. Ajusta aquí si hace falta.
  const nombresSalida = sesion.outputNames;
  const rawBoxes = salida[nombresSalida[0]].data;   // [N, 4] rel_xyxy
  const rawScores = salida[nombresSalida[1]].data;  // [N, 20] por clase

  const n = rawScores.length / NOMBRES_CLASES.length;
  const cajas = [], confianzas = [], clases = [];

  for (let i = 0; i < n; i++) {
    let mejorClase = -1, mejorScore = 0;
    for (let c = 0; c < NOMBRES_CLASES.length; c++) {
      const score = rawScores[i * NOMBRES_CLASES.length + c];
      if (score > mejorScore) { mejorScore = score; mejorClase = c; }
    }
    if (mejorScore >= UMBRAL_CONFIANZA) {
      cajas.push([rawBoxes[i * 4], rawBoxes[i * 4 + 1], rawBoxes[i * 4 + 2], rawBoxes[i * 4 + 3]]);
      confianzas.push(mejorScore);
      clases.push(mejorClase);
    }
  }

  const indicesFinales = nms(cajas, confianzas, clases);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const i of indicesFinales) {
    const [x1, y1, x2, y2] = cajas[i];
    // rel_xyxy sobre 416x416 con letterbox -> píxeles del video real
    const px1 = (x1 * TAMANO_ENTRADA) / escala;
    const py1 = (y1 * TAMANO_ENTRADA) / escala;
    const px2 = (x2 * TAMANO_ENTRADA) / escala;
    const py2 = (y2 * TAMANO_ENTRADA) / escala;

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    ctx.strokeRect(px1, py1, px2 - px1, py2 - py1);
    ctx.fillStyle = "#00ff00";
    ctx.font = "18px Arial";
    ctx.fillText(`${NOMBRES_CLASES[clases[i]]} ${Math.round(confianzas[i] * 100)}%`, px1, py1 - 8);
  }
}

async function bucleDeteccion() {
  while (true) {
    if (video.videoWidth > 0 && sesion) {
      try {
        await detectar();
      } catch (e) {
        console.error("Error en detección:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

(async () => {
  await iniciarCamara();
  await cargarModelo();
  bucleDeteccion();
})();
