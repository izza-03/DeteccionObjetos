// =======================================
// URL DEL BACKEND EN RENDER
// =======================================

const WS_URL = "wss://deteccion-objetos.onrender.com/camara";


// =======================================

const video = document.getElementById("video");

const resultado = document.getElementById("resultado");

const estado = document.getElementById("estado");


const canvas = document.createElement("canvas");

const ctx = canvas.getContext("2d");


let ws;


// =======================================
// INICIAR CAMARA
// =======================================

async function iniciarCamara(){

    try{


        const stream = await navigator.mediaDevices.getUserMedia({

            video:{

                facingMode:"environment"

            },

            audio:false

        });


        video.srcObject = stream;


        console.log("Camara iniciada");


    }

    catch(error){

        console.error(error);

        estado.innerHTML="Error al abrir cámara";

    }

}



// =======================================
// CONECTAR WEBSOCKET
// =======================================

function conectar(){


    ws = new WebSocket(WS_URL);



    ws.onopen = ()=>{


        console.log("WebSocket conectado");


        estado.innerHTML="Conectado";


        enviarFrames();


    };



    ws.onmessage = (event)=>{


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


    };



    ws.onerror = (error)=>{

        console.error(
            "WebSocket error",
            error
        );

    };



    ws.onclose = ()=>{


        estado.innerHTML="Reconectando...";


        setTimeout(conectar,2000);


    };


}



// =======================================
// ENVIAR FRAMES A YOLO
// =======================================

async function enviarFrames(){



    while(ws.readyState === WebSocket.OPEN){



        if(video.videoWidth === 0){


            await esperar(100);

            continue;

        }



        canvas.width = 640;

        canvas.height = 480;



        ctx.drawImage(

            video,

            0,

            0,

            640,

            480

        );



        const imagen = canvas

            .toDataURL(
                "image/jpeg",
                0.7
            )

            .split(",")[1];




        ws.send(JSON.stringify({

            imagen:imagen,

            umbral:0.55

        }));



        await esperar(100);



    }


}



// =======================================

function esperar(ms){

    return new Promise(resolve=>{

        setTimeout(resolve,ms);

    });

}



// =======================================
// ARRANQUE
// =======================================

(async()=>{


    await iniciarCamara();


    conectar();



})();
