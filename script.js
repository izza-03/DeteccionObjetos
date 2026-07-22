const WS_URL =
"wss://deteccion-objetos.onrender.com/camara";



const video =
document.getElementById("video");


const canvas =
document.getElementById("canvas");


const ctx =
canvas.getContext("2d");


const estado =
document.getElementById("estado");



let ws;



const captura =
document.createElement("canvas");


const capturaCtx =
captura.getContext("2d");




// ===============================
// CAMARA
// ===============================


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



video.srcObject=stream;



video.onloadedmetadata=()=>{


canvas.width=
video.videoWidth;


canvas.height=
video.videoHeight;


captura.width=
video.videoWidth;


captura.height=
video.videoHeight;


};



estado.innerHTML="Cámara activa";


}


catch(e){


console.error(e);

estado.innerHTML=
"No se pudo abrir cámara";


}


}





// ===============================
// WEBSOCKET
// ===============================


function conectar(){


ws=new WebSocket(
WS_URL
);



ws.onopen=()=>{


console.log(
"WebSocket conectado"
);


estado.innerHTML=
"Modelo conectado";


enviarFrames();


};





ws.onmessage=(event)=>{


const data=
JSON.parse(event.data);



ctx.clearRect(
0,
0,
canvas.width,
canvas.height
);




if(data.detecciones){



data.detecciones.forEach(det=>{



ctx.strokeStyle=
"#00ff00";


ctx.lineWidth=3;



ctx.strokeRect(

det.x,

det.y,

det.ancho,

det.alto

);



ctx.fillStyle=
"#00ff00";


ctx.font=
"18px Arial";



ctx.fillText(

det.objeto+
" "+
Math.round(det.confianza*100)
+"%",

det.x,

det.y-8

);



});



}



};





ws.onclose=()=>{


estado.innerHTML=
"Reconectando...";


setTimeout(
conectar,
3000
);


};


}





// ===============================
// ENVIAR FRAMES
// ===============================


async function enviarFrames(){


while(
ws &&
ws.readyState===WebSocket.OPEN
){



if(video.videoWidth===0){

await esperar(100);

continue;

}




capturaCtx.drawImage(

video,

0,

0,

captura.width,

captura.height

);



const imagen =
captura.toDataURL(
"image/jpeg",
0.6
)
.split(",")[1];





ws.send(JSON.stringify({

imagen:imagen,

umbral:0.55


}));



await esperar(80);



}


}





function esperar(ms){

return new Promise(
r=>setTimeout(r,ms)
);

}




(async()=>{


await iniciarCamara();


conectar();


})();
