const connectBtn = document.getElementById('connectBtn');
const micBtn = document.getElementById('micBtn');
const connectionStatus = document.getElementById('connectionStatus');
const micStatus = document.getElementById('micStatus');
const volumeBar = document.getElementById('volumeBar');
const actionBtns = document.querySelectorAll('.action-btn');

const geminiBtn = document.getElementById('geminiBtn');
const userTextSpan = document.getElementById('userText');
const iaTextSpan = document.getElementById('iaText');

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

let bluetoothDevice;
let characteristic;
let isConnected = false;

// Variables para micrófono
let audioContext;
let analyser;
let microphone;
let isMicActive = false;
let animationId;

let isTalking = false; 
const TALKING_THRESHOLD = 10; // Nivel de volumen para considerar que hay voz (0-100)
let silenceTimer;

// ======== BLUETOOTH ========

connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        disconnectDevice();
    } else {
        connectDevice();
    }
});

async function connectDevice() {
    try {
        console.log('Solicitando dispositivo Bluetooth...');
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [SERVICE_UUID]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        console.log('Conectando al servidor GATT...');
        const server = await bluetoothDevice.gatt.connect();

        console.log('Obteniendo Servicio...');
        const service = await server.getPrimaryService(SERVICE_UUID);

        console.log('Obteniendo Característica...');
        characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        isConnected = true;
        updateUIConnected();
        console.log('¡Conectado a Robotito!');

    } catch (error) {
        console.error('Error de conexión:', error);
        alert('Error al conectar: ' + error.message);
    }
}

function disconnectDevice() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
    }
}

function onDisconnected() {
    console.log('Dispositivo desconectado');
    isConnected = false;
    updateUIDisconnected();
    if (isMicActive) {
        stopMic();
    }
}

async function sendCommand(cmd) {
    if (!isConnected || !characteristic) return;
    try {
        const encoder = new TextEncoder();
        await characteristic.writeValue(encoder.encode(cmd));
        console.log(`Comando enviado: ${cmd}`);
    } catch (error) {
        console.error('Error al enviar comando:', error);
    }
}

// ======== UI UPDATES ========

function updateUIConnected() {
    connectBtn.innerHTML = '<span class="icon">🔌</span> Desconectar';
    connectBtn.classList.replace('primary', 'red');
    connectionStatus.textContent = 'Conectado';
    connectionStatus.className = 'badge green';
    micBtn.disabled = false;
}

function updateUIDisconnected() {
    connectBtn.innerHTML = '<span class="icon">🔌</span> Conectar a RobotitoBLE';
    connectBtn.classList.replace('red', 'primary');
    connectionStatus.textContent = 'Desconectado';
    connectionStatus.className = 'badge red';
    micBtn.disabled = true;
}

// ======== BOTONES MANUALES ========

actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        sendCommand(cmd);
        
        // Efecto visual
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = '', 100);
    });
});

// ======== MICRÓFONO & LÓGICA DE VOZ ========

micBtn.addEventListener('click', () => {
    if (isMicActive) {
        stopMic();
    } else {
        startMic();
    }
});

async function startMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        isMicActive = true;
        micBtn.innerHTML = '<span class="icon">⏹️</span> Detener Micrófono';
        micBtn.classList.replace('secondary', 'red');
        micStatus.textContent = 'Escuchando...';
        micStatus.className = 'badge green';
        
        processAudio();
    } catch (err) {
        console.error('Error accediendo al micrófono:', err);
        alert('No se pudo acceder al micrófono. Asegúrate de dar permisos en tu navegador (chrome://settings/content/microphone).');
    }
}

function stopMic() {
    if (animationId) cancelAnimationFrame(animationId);
    if (audioContext) audioContext.close();
    
    isMicActive = false;
    micBtn.innerHTML = '<span class="icon">🎙️</span> Activar Micrófono';
    micBtn.classList.replace('red', 'secondary');
    micStatus.textContent = 'Inactivo';
    micStatus.className = 'badge yellow';
    volumeBar.style.width = '0%';
    
    // Si estaba hablando, lo callamos
    if (isTalking) {
        isTalking = false;
        sendCommand('9'); // Volver a caraAlegre (callado)
    }
}

function processAudio() {
    if (!isMicActive) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calcular volumen promedio
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // Multiplicamos por 2 para más sensibilidad (se puede ajustar)
    const volumePercent = Math.min(100, Math.round((average / 255) * 100 * 2)); 
    
    volumeBar.style.width = `${volumePercent}%`;
    
    // Lógica para enviar comandos según la voz
    if (volumePercent > TALKING_THRESHOLD) {
        if (!isTalking) {
            isTalking = true;
            // Enviamos '8' que es la cara hablando SIN el beep
            sendCommand('8'); 
            clearTimeout(silenceTimer);
        }
    } else {
        if (isTalking) {
            // Si el volumen bajó, esperamos un poquito antes de cerrar la boca (para que no titile rápido)
            if (!silenceTimer) {
                silenceTimer = setTimeout(() => {
                    isTalking = false;
                    // Enviamos '9' que es la cara callada SIN beep
                    sendCommand('9'); 
                    silenceTimer = null;
                }, 200); // 200ms de silencio para volver a cerrar boca
            }
        }
    }
    
    animationId = requestAnimationFrame(processAudio);
}

// ======== INTELIGENCIA ARTIFICIAL (GEMINI + SPEECH) ========

// Configurar Reconocimiento de Voz
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; // Idioma español
    recognition.interimResults = false;
    
    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        userTextSpan.textContent = transcript;
        userTextSpan.className = ""; // Quitar color gris
        
        geminiBtn.innerHTML = '<span class="icon">🧠</span> Robotito Pensando...';
        sendCommand('5'); // Poner cara de "Pensando" en el ESP32
        
        // 1. Enviar el texto al backend seguro de Vercel
        const respuestaIA = await fetchChat(transcript);
        
        iaTextSpan.textContent = respuestaIA;
        iaTextSpan.className = "";
        
        geminiBtn.innerHTML = '<span class="icon">✨</span> Hablar con la IA';
        geminiBtn.classList.remove('pulse');
        
        // 2. Hacer que hable y mover la boca del ESP32 por Bluetooth
        hablarYAnimarRobot(respuestaIA);
    };

    recognition.onerror = (event) => {
        console.error("Error reconociendo voz:", event.error);
        geminiBtn.innerHTML = '<span class="icon">✨</span> Hablar con la IA';
        geminiBtn.classList.remove('pulse');
    };
} else {
    alert("Tu navegador no soporta Reconocimiento de Voz. Usa Chrome o Edge.");
}

geminiBtn.addEventListener('click', () => {
    if (!recognition) return;
    
    // Detener la reacción de voz básica si está encendida
    if (isMicActive) stopMic(); 
    
    recognition.start();
    geminiBtn.innerHTML = '<span class="icon">👂</span> Escuchando...';
    geminiBtn.classList.add('pulse');
    userTextSpan.textContent = "Te escucho...";
    iaTextSpan.textContent = "...";
});

// Función para consultar la IA a través del backend seguro de Vercel (/api/chat)
// La API Key de Gemini vive en el servidor — el usuario nunca la ve.
async function fetchChat(prompt) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (response.ok && data.respuesta) {
            return data.respuesta;
        } else {
            console.error('Error del servidor /api/chat:', data);
            return '¡Bip bop! El servidor no pudo contactar la IA. Verifica la variable de entorno en Vercel.';
        }
    } catch (error) {
        console.error('Error de red al llamar a /api/chat:', error);
        return '¡Ups! No hay internet o el servidor de Vercel no responde.';
    }
}

// Función que lee el texto en voz alta y mueve la boca del Robot
function hablarYAnimarRobot(texto) {
    // ---- LEER EL TEXTO (Text-to-Speech) Y HACER LIP SYNC ----
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.pitch = 1.2; // Voz un poquito más aguda para el robotito
    utterance.rate = 1.1;  // Habla un poco más rápido
    
    // Simulador de Lip Sync súper sencillo (Alternar boca abierta y cerrada mientras habla)
    let lipSyncInterval;
    
    utterance.onstart = () => {
        let open = true;
        lipSyncInterval = setInterval(() => {
            sendCommand(open ? '8' : '9'); // 8=Abre, 9=Cierra
            open = !open;
        }, 150); // Cambia cada 150ms
    };
    
    utterance.onend = () => {
        clearInterval(lipSyncInterval);
        sendCommand('1'); // Volver a cara alegre al terminar
    };
    
    window.speechSynthesis.speak(utterance);
}

// Función extra: Cómo enviar texto largo por BLE (Chunking)
async function enviarTextoLargoBLE(texto) {
    if (!isConnected || !characteristic) return;
    
    const encoder = new TextEncoder();
    // Le ponemos una 'T' al inicio para que el ESP32 sepa que es Texto y no un comando numérico
    const bytes = encoder.encode("T" + texto); 
    
    // Bluetooth Low Energy solo permite enviar de a 20 bytes por defecto
    const CHUNK_SIZE = 20;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        try {
            await characteristic.writeValue(chunk);
            await new Promise(r => setTimeout(r, 50)); // Esperar 50ms entre pedacitos
        } catch (e) {
            console.error("Error enviando texto BLE:", e);
        }
    }
}
