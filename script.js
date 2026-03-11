const button = document.querySelector("button");
button.addEventListener("click", () =>{
    // Crear el contexto de audio
    let audioContext = new AudioContext();
    var buffer = audioContext.createBuffer(1, 1, 22050);
    var node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.start(0);

    // Crear un oscilador con onda sinusoidal
    var osc = audioContext.createOscillator();
    osc.connect( audioContext.destination );
    osc.frequency.value = 880.0;
    osc.start(audioContext.currentTime);
    console.log("DEbug");

}); 