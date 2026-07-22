// ==========================================
// CAMBIA ESTA URL POR LA DE TU BACKEND
// ==========================================

const WS_URL = "ws://127.0.0.1:8000/camara";


// ==========================================

const video = document.getElementById("video");

const resultado = document.getElementById("resultado");

const estado = document.getElementById("estado");

const canvas = document.createElement("canvas");

const ctx = canvas.getContext("2d");

let ws;

//--------------------------------------------

async function iniciarCamara(){

    try{

        const stream = await navigator.mediaDevices.getUserMedia({

            video:{
                facingMode:"environment"
            },

            audio:false

        });

        video.srcObject = stream;

    }

    catch(e){

        estado.innerHTML="No se pudo abrir la cámara.";

        console.error(e);

    }

}

//--------------------------------------------

function conectar(){

    ws = new WebSocket(WS_URL);

    ws.onopen=()=>{

        estado.innerHTML="Conectado";

        enviarFrames();

    };

    ws.onclose=()=>{

        estado.innerHTML="Reconectando...";

        setTimeout(conectar,2000);

    };

    ws.onerror=(e)=>{

        console.log(e);

    };

    ws.onmessage=(event)=>{

        const data = JSON.parse(event.data);

        if(data.imagen){

            resultado.src="data:image/jpeg;base64,"+data.imagen;

        }

    };

}

//--------------------------------------------

async function enviarFrames(){

    while(ws.readyState===1){

        if(video.videoWidth===0){

            await dormir(100);

            continue;

        }

        canvas.width=640;

        canvas.height=480;

        ctx.drawImage(video,0,0,640,480);

        const imagen = canvas

            .toDataURL("image/jpeg",0.7)

            .split(",")[1];

        ws.send(JSON.stringify({

            imagen:imagen,

            umbral:0.55

        }));

        await dormir(120);

    }

}

//--------------------------------------------

function dormir(ms){

    return new Promise(resolve=>setTimeout(resolve,ms));

}

//--------------------------------------------

(async()=>{

    await iniciarCamara();

    conectar();

})();
