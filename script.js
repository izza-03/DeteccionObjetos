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


let UMBRAL = 0.25;



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





// =================================
// CAMARA
// =================================


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
"Error camara";

}


}







// =================================
// CARGAR MODELO
// =================================


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







// =================================
// PREPROCESAR
// =================================


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
Math.round(
ancho*escala
);



const nuevoAlto =
Math.round(
alto*escala
);




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





const pixeles =
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

i<pixeles.length;

i+=4,j+=3

){



entrada[j] =
pixeles[i]/255/255;


entrada[j+1] =
pixeles[i+1]/255/255;


entrada[j+2] =
pixeles[i+2]/255/255;


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







// =================================
// IOU PARA NMS
// =================================


function calcularIOU(a,b){


const x1 =
Math.max(a.x1,b.x1);


const y1 =
Math.max(a.y1,b.y1);


const x2 =
Math.min(a.x2,b.x2);


const y2 =
Math.min(a.y2,b.y2);



const inter =
Math.max(0,x2-x1) *
Math.max(0,y2-y1);



const areaA =
(a.x2-a.x1)*
(a.y2-a.y1);



const areaB =
(b.x2-b.x1)*
(b.y2-b.y1);



return inter /
(areaA+areaB-inter+0.0001);


}




function aplicarNMS(detecciones){


detecciones.sort(
(a,b)=>
b.confianza-a.confianza
);



const resultado=[];



for(
const det of detecciones
){



let eliminar=false;



for(
const r of resultado
){


if(
det.clase===r.clase &&
calcularIOU(det,r)>0.4
){

eliminar=true;

break;

}


}



if(!eliminar)
resultado.push(det);



}



return resultado;


}







// =================================
// DETECTAR
// =================================


async function detectar(){



const tensor =
prepararImagen();



const entrada =
sesion.inputNames[0];



const salida =
await sesion.run({

[entrada]:tensor

});



const boxes =
salida.boxes.data;



const classes =
salida.classes.data;




const cantidad =
salida.boxes.dims[1];



let detecciones=[];



for(

let i=0;

i<cantidad;

i++

){



const boxOffset =
i*64;



const classOffset =
i*20;





let mejorClase=-1;

let confianza=0;



for(

let c=0;

c<20;

c++

){



const score =
classes[
classOffset+c
];



if(score>confianza){

confianza=score;

mejorClase=c;

}


}




if(confianza < UMBRAL)
continue;






// formato cx cy w h
let cx =
boxes[boxOffset];


let cy =
boxes[boxOffset+1];


let w =
boxes[boxOffset+2];


let h =
boxes[boxOffset+3];





let x1 =
cx-w/2;


let y1 =
cy-h/2;


let x2 =
cx+w/2;


let y2 =
cy+h/2;





// pasar 416 a pantalla

x1 =
x1/TAMANO_ENTRADA*
canvas.width;


x2 =
x2/TAMANO_ENTRADA*
canvas.width;



y1 =
y1/TAMANO_ENTRADA*
canvas.height;


y2 =
y2/TAMANO_ENTRADA*
canvas.height;





detecciones.push({

x1,

y1,

x2,

y2,

clase:mejorClase,

confianza

});


}





detecciones =
aplicarNMS(detecciones);






ctx.clearRect(

0,

0,

canvas.width,

canvas.height

);





for(
const d of detecciones
){



ctx.strokeStyle =
"#00ff00";


ctx.lineWidth =
3;



ctx.strokeRect(

d.x1,

d.y1,

d.x2-d.x1,

d.y2-d.y1

);



ctx.fillStyle =
"#00ff00";


ctx.font =
"18px Arial";



ctx.fillText(

NOMBRES_CLASES[d.clase]
+
" "
+
Math.round(d.confianza*100)
+
"%",

d.x1,

d.y1-8

);



}



}








// =================================
// LOOP
// =================================


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
"Error:",
e
);

}


}



await new Promise(

r=>setTimeout(r,100)

);



}


}







// =================================
// INICIO
// =================================


(async()=>{


await iniciarCamara();


await cargarModelo();


bucle();


})();
