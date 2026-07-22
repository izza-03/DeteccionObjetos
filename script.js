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



let modelo=null;



const captura =
document.createElement("canvas");


captura.width=TAMANO_ENTRADA;

captura.height=TAMANO_ENTRADA;


const capturaCtx =
captura.getContext("2d");





// ===============================
// CAMARA
// ===============================


async function iniciarCamara(){


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



video.srcObject=stream;



video.onloadedmetadata=()=>{


canvas.width=
video.videoWidth;


canvas.height=
video.videoHeight;


};



estado.innerHTML=
"Camara activa";


}






// ===============================
// CARGAR MODELO
// ===============================


async function cargarModelo(){


estado.innerHTML=
"Cargando modelo...";


modelo =
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
modelo.inputNames
);


console.log(
"Salidas:",
modelo.outputNames
);



estado.innerHTML=
"Modelo listo";


}





// ===============================
// PREPROCESADO
// ===============================


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



capturaCtx.fillStyle="black";


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

TAMANO_ENTRADA*
TAMANO_ENTRADA*
3

);



for(
let i=0,j=0;

i<datos.length;

i+=4,j+=3

){


entrada[j]=datos[i]/255/255;


entrada[j+1]=datos[i+1]/255/255;


entrada[j+2]=datos[i+2]/255/255;


}



return {


tensor:new ort.Tensor(

"float32",

entrada,

[

1,

TAMANO_ENTRADA,

TAMANO_ENTRADA,

3

]

),


escala

};


}





// ===============================
// DETECCION
// ===============================


async function detectar(){



const datos =
prepararImagen();



const entrada =
modelo.inputNames[0];



const salida =
await modelo.run({

[entrada]:
datos.tensor

});




console.log(salida);



ctx.clearRect(

0,

0,

canvas.width,

canvas.height

);




// Aquí se leen las salidas ONNX

const boxes =
salida.boxes.data;


const classes =
salida.classes.data;



const cantidad =
classes.length /
NOMBRES_CLASES.length;



for(
let i=0;

i<cantidad;

i++

){



let mejor=-1;

let score=0;



for(
let c=0;

c<NOMBRES_CLASES.length;

c++

){


let valor =
classes[
i*NOMBRES_CLASES.length+c
];


if(valor>score){

score=valor;

mejor=c;

}


}




if(score<UMBRAL)
continue;



const x1 =
boxes[i*4];


const y1 =
boxes[i*4+1];


const x2 =
boxes[i*4+2];


const y2 =
boxes[i*4+3];




ctx.strokeStyle="#00ff00";

ctx.lineWidth=3;



ctx.strokeRect(

x1,

y1,

x2-x1,

y2-y1

);



ctx.fillStyle="#00ff00";

ctx.font="18px Arial";


ctx.fillText(

NOMBRES_CLASES[mejor]+
" "+
Math.round(score*100)+"%",

x1,

y1-5

);



}




}







async function bucle(){



while(true){


if(modelo &&
video.videoWidth>0){


try{


await detectar();


}

catch(e){

console.error(
"Error detección",
e
);

}


}



await new Promise(

r=>setTimeout(r,100)

);



}



}





// ===============================
// INICIO
// ===============================


(async()=>{


await iniciarCamara();


await cargarModelo();


bucle();


})();
