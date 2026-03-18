const noteLength = 0.05;
const lookAheadTime = 0.25;
let audioContext = new AudioContext();
let tempo = 60.0;
let playing = false;
let nextBeatTime = 0;
let playMetronome = null;
/* Not needed for now, maybe in the future

var buffer = audioContext.createBuffer(1, 1, 22050);
var node = audioContext.createBufferSource();
node.buffer = buffer;
node.start(0);*/


const playButton = document.getElementById("playButton");
//Funtion to Start the metronome
playButton.addEventListener("click", () => {
    //On/Off
    playing = !playing;
    
    //On
    if(playing){
        playButton.textContent = "Stop";
        nextBeatTime = audioContext.currentTime + 0.1;
        playMetronome = setInterval(scheduler, 100);
    } else{
        playButton.textContent = "Start";
        clearInterval(playMetronome);
        playMetronome = null;
    }


}); 

function scheduler(){
    while(nextBeatTime < audioContext.currentTime + lookAheadTime){
        scheduleBeat();
        setNextBeat();
    }
}

function scheduleBeat(){
    const osc = audioContext.createOscillator();
    osc.connect(audioContext.destination);
    osc.frequency.value = 880.0;
    osc.start(nextBeatTime);
    osc.stop(nextBeatTime+noteLength);
}

function setNextBeat(){
    nextBeatTime += 60/tempo;
}


const submitTempoBtn = document.getElementById("submitTempo");
submitTempoBtn.addEventListener("click", () => {
    const inputTempo = document.getElementById("inputTempo");
    tempo = inputTempo.value;
    inputTempo.value = "";
});