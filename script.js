const RUTA_MODELO =
"https://huggingface.co/eliii03/Objeto/resolve/main/modelo_v2_convertido.onnx";


const TAMANO_ENTRADA = 416;


const NOMBRES_CLASES = [
"Backpack",
"Bed",
"Bottle",
"Chair",
"Couch",
"Door",
"Fork",
"Glass",
"Hat",
"Jug",
"Knife",
"Lamp",
"Mirror",
"Mug",
"Oven",
"Plate",
"Spoon",
"Table",
"Television",
"Wok"
];


const UMBRAL = 0.55;



const video =
document.getElementById("video");


const canvas =
document.getElementById("canvas");


const ctx =
canvas.getContext("2d");


const estado =
document.getElementById("estado");



let sesion = null;



const captura =
document.createElement("canvas");


captura.width = TAMANO_ENTRADA;
captura.height = TAMANO_ENTRADA;


const capturaCtx =
captura.getContext(
"2d",
{
willReadFrequently:true
}
);




// ============================
// CAMARA
// ============================

async function iniciarCamara(){

try{


const stream =
await navigator.mediaDevices.getUserMedia({

video:{
facingMode:{
ideal:"environment"
},

width:{
ideal:640
},

height:{
ideal:480
}

},

audio:false

});


video.srcObject = stream;



video.onloadedmetadata = ()=>{

canvas.width =
video.videoWidth;


canvas.height =
video.videoHeight;

};



estado.innerHTML =
"Camara activa";


}

catch(e){

console.error(e);

estado.innerHTML =
"No se pudo abrir camara";

}


}




// ============================
// MODELO ONNX
// ============================


async function cargarModelo(){


estado.innerHTML =
"Cargando modelo...";


sesion =
await ort.InferenceSession.create(

RUTA_MODELO,

{

executionProviders:[
"wasm"
]

}

);



console.log(
"Entradas:",
sesion.inputNames
);


console.log(
"Salidas:",
sesion.outputNames
);



estado.innerHTML =
"Modelo listo";


}





// ============================
// PREPROCESADO
// ============================


function prepararImagen(){


const ancho =
video.videoWidth;


const alto =
video.videoHeight;



const escala =
Math.min(

TAMANO_ENTRADA/ancho,

TAMANO_ENTRADA/alto

);



const nuevoAncho =
Math.round(ancho*escala);


const nuevoAlto =
Math.round(alto*escala);



capturaCtx.fillStyle =
"black";


capturaCtx.fillRect(

0,
0,

TAMANO_ENTRADA,
TAMANO_ENTRADA

);



capturaCtx.drawImage(

video,

0,
0,

nuevoAncho,
nuevoAlto

);



const datos =
capturaCtx.getImageData(

0,
0,

TAMANO_ENTRADA,
TAMANO_ENTRADA

).data;



const entrada =
new Float32Array(

TAMANO_ENTRADA *
TAMANO_ENTRADA *
3

);



for(
let i=0,j=0;

i<datos.length;

i+=4,j+=3

){


entrada[j] =
datos[i]/255/255;


entrada[j+1] =
datos[i+1]/255/255;


entrada[j+2] =
datos[i+2]/255/255;


}



return new ort.Tensor(

"float32",

entrada,

[
1,
TAMANO_ENTRADA,
TAMANO_ENTRADA,
3
]

);


}





// ============================
// DETECCION + DEBUG
// ============================


async function detectar(){


const tensor =
prepararImagen();



const entrada =
sesion.inputNames[0];



const salida =
await sesion.run({

[entrada]:tensor

});



const rawBoxes =
salida.boxes.data;


const rawClasses =
salida.classes.data;



// ======================
// DEBUG TEMPORAL
// ======================


console.log(
"BOX DIMS:",
salida.boxes.dims
);


console.log(
"CLASS DIMS:",
salida.classes.dims
);



console.log(
"PRIMERAS BOX:",
Array.from(
rawBoxes.slice(0,20)
)
);



console.log(
"PRIMERAS CLASS:",
Array.from(
rawClasses.slice(0,40)
)
);




// ======================
// DIBUJO
// ======================


ctx.clearRect(

0,
0,

canvas.width,
canvas.height

);



const cantidadBoxes =
rawBoxes.length / 4;


const cantidadClases =
rawClasses.length /
NOMBRES_CLASES.length;



console.log(
"Boxes:",
cantidadBoxes,
"Clases:",
cantidadClases
);



const cantidad =
Math.min(
cantidadBoxes,
cantidadClases
);



for(
let i=0;

i<cantidad;

i++

){


let mejorClase=-1;

let confianza=0;



for(
let c=0;

c<NOMBRES_CLASES.length;

c++

){


const score =
rawClasses[
i*NOMBRES_CLASES.length+c
];



if(score>confianza){

confianza=score;

mejorClase=c;

}


}



if(confianza < UMBRAL)
continue;




let x1 =
rawBoxes[i*4];


let y1 =
rawBoxes[i*4+1];


let x2 =
rawBoxes[i*4+2];


let y2 =
rawBoxes[i*4+3];




x1 *= canvas.width;
x2 *= canvas.width;

y1 *= canvas.height;
y2 *= canvas.height;




ctx.strokeStyle =
"#00ff00";


ctx.lineWidth =
3;


ctx.strokeRect(

x1,

y1,

x2-x1,

y2-y1

);



ctx.fillStyle =
"#00ff00";


ctx.font =
"18px Arial";


ctx.fillText(

NOMBRES_CLASES[mejorClase]
+
" "
+
Math.round(confianza*100)
+
"%",

x1,

y1-8

);



}



}





// ============================
// LOOP
// ============================


async function bucle(){


while(true){


if(
sesion &&
video.videoWidth>0
){


try{

await detectar();

}

catch(e){

console.error(
"Error deteccion:",
e
);

}


}



await new Promise(

r=>setTimeout(r,150)

);



}


}





// ============================
// INICIO
// ============================


(async()=>{


await iniciarCamara();


await cargarModelo();


bucle();


})();
