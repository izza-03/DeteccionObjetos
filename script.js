// ==========================================
// BACKEND RENDER WEBSOCKET
// ==========================================

const WS_URL = "wss://deteccion-objetos.onrender.com/camara";


// ==========================================
// ELEMENTOS HTML
// ==========================================

const video = document.getElementById("video");
const resultado = document.getElementById("resultado");
const estado = document.getElementById("estado");

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

let ws = null;


// ==========================================
// ACTIVAR CAMARA DEL TELEFONO / LAPTOP
// ==========================================

async function iniciarCamara(){

    try{

        console.log("Solicitando cámara...");

        const stream = await navigator.mediaDevices.getUserMedia({

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

        console.log(" Cámara activada");

    }

    catch(e){

        console.error(" Error cámara:", e);

        estado.innerHTML = "No se pudo abrir la cámara";

    }

}


// ==========================================
// CONECTAR WEBSOCKET
// ==========================================

function conectar(){

    console.log("Conectando a:", WS_URL);


    ws = new WebSocket(WS_URL);


    ws.onopen = ()=>{

        console.log("✅ WebSocket conectado");

        estado.innerHTML = "Conectado";

        enviarFrames();

    };


    ws.onmessage = (event)=>{

        try{

            const data = JSON.parse(event.data);


            if(data.imagen){

                resultado.src =
                "data:image/jpeg;base64," + data.imagen;

            }


            if(data.detecciones){

                console.log(
                    "Detecciones:",
                    data.detecciones
                );

            }

        }

        catch(e){

            console.error(
                "Error procesando respuesta:",
                e
            );

        }

    };


    ws.onerror = (error)=>{

        console.error(
            " Error WebSocket:",
            error
        );

    };


    ws.onclose = ()=>{

        console.log(
            " WebSocket cerrado. Reintentando..."
        );

        estado.innerHTML="Reconectando...";


        setTimeout(()=>{

            conectar();

        },3000);

    };

}


// ==========================================
// ENVIAR FRAMES AL MODELO
// ==========================================

async function enviarFrames(){


    console.log(
        "Comenzando envío de imágenes..."
    );


    while(ws && ws.readyState === WebSocket.OPEN){


        if(video.videoWidth === 0){

            await dormir(100);

            continue;

        }


        canvas.width = 640;
        canvas.height = 480;


        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );


        const imagen = canvas
            .toDataURL(
                "image/jpeg",
                0.7
            )
            .split(",")[1];


        ws.send(JSON.stringify({

            imagen: imagen,

            umbral:0.30

        }));


        await dormir(120);

    }

}


// ==========================================
// ESPERA
// ==========================================

function dormir(ms){

    return new Promise(
        resolve=>setTimeout(resolve,ms)
    );

}


// ==========================================
// INICIO
// ==========================================

(async()=>{

    await iniciarCamara();

    conectar();

})();
