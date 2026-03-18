// ====== Audio engine ======

const noteLength = 0.05;
const lookAheadTime = 0.25;

let audioContext = null;
let tempo = 120;
let playing = false;
let nextEventTime = 0;
let schedulerId = null;

let pattern = []; // array of steps: {accent: boolean, rest: boolean}
let polyPatternTop = [];
let polyPatternBottom = [];
let currentStep = 0;
let currentPolyTopStep = 0;
let currentPolyBottomStep = 0;

let currentMode = "simple"; // 'simple' | 'polyrhythm' | 'custom'

// Sound settings
let soundPreset = "beep";
let accentGainLevel = 1.0;
let weakGainLevel = 0.6;

// DOM elements
const playButton = document.getElementById("playButton");
const tapButton = document.getElementById("tapButton");
const tempoInput = document.getElementById("inputTempo");
const tempoStepButtons = document.querySelectorAll(".tempo-step");

const beatsPerBarInput = document.getElementById("beatsPerBar");
const subdivisionSelect = document.getElementById("subdivision");
const topPolyInput = document.getElementById("topPoly");
const bottomPolyInput = document.getElementById("bottomPoly");
const patternInput = document.getElementById("patternInput");

const soundSelect = document.getElementById("soundSelect");
const accentVolumeSlider = document.getElementById("accentVolume");
const weakVolumeSlider = document.getElementById("weakVolume");

const simpleControls = document.getElementById("simpleControls");
const polyControls = document.getElementById("polyControls");
const customControls = document.getElementById("customControls");

const notationTrack = document.getElementById("notationTrack");
const polyNotationTrack = document.getElementById("polyNotationTrack");
const notationLabel = document.getElementById("notationLabel");

// ====== Utility ======

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function updateTempo(newTempo) {
    const t = Number(newTempo);
    if (Number.isFinite(t) && t >= 20 && t <= 300) {
        tempo = t;
        tempoInput.value = tempo;
    }
}

// ====== Sound design ======

function createClickSound(time, isAccent) {
    const ctx = audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseGain = isAccent ? accentGainLevel : weakGainLevel;

    gain.gain.setValueAtTime(baseGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteLength);

    switch (soundPreset) {
        case "woodblock":
            osc.type = "square";
            osc.frequency.setValueAtTime(isAccent ? 1100 : 800, time);
            break;
        case "hihat":
            osc.type = "triangle";
            osc.frequency.setValueAtTime(isAccent ? 8000 : 6000, time);
            break;
        default: // beep
            osc.type = "sine";
            osc.frequency.setValueAtTime(isAccent ? 1760 : 880, time);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + noteLength);
}

function scheduler() {
    const ctx = audioContext;
    while (nextEventTime < ctx.currentTime + lookAheadTime) {
        scheduleNextStep();
        advanceStep();
    }
}

function scheduleNextStep() {
    const stepInfo =
        currentMode === "polyrhythm"
            ? null // handle inside poly scheduler
            : pattern[currentStep];

    const interval = 60 / tempo;

    if (currentMode === "polyrhythm") {
        // compute both top and bottom pulses inside interval
        const topLen = polyPatternTop.length;
        const bottomLen = polyPatternBottom.length;

        const eventTime = nextEventTime;

        // Top rhythm pulse
        const topAccent = polyPatternTop[currentPolyTopStep].accent;
        if (!polyPatternTop[currentPolyTopStep].rest) {
            createClickSound(eventTime, topAccent);
        }

        // Bottom rhythm pulse slightly later in interval so both are audible
        const bottomTime = eventTime + interval / 2;
        const bottomAccent = polyPatternBottom[currentPolyBottomStep].accent;
        if (!polyPatternBottom[currentPolyBottomStep].rest) {
            createClickSound(bottomTime, bottomAccent);
        }

        // Visual
        highlightNotationStep(
            notationTrack,
            currentPolyTopStep,
            "polyTop",
            topAccent
        );
        highlightNotationStep(
            polyNotationTrack,
            currentPolyBottomStep,
            "polyBottom",
            bottomAccent
        );

        return;
    }

    if (!stepInfo || stepInfo.rest) {
        // silence but still advance time
        nextEventTime += interval / (pattern.length || 1);
        return;
    }

    createClickSound(nextEventTime, stepInfo.accent);
    highlightNotationStep(notationTrack, currentStep, "main", stepInfo.accent);
}

function advanceStep() {
    const interval = 60 / tempo;
    if (currentMode === "polyrhythm") {
        const lcmLen = lcm(polyPatternTop.length, polyPatternBottom.length);
        const stepDuration = interval / lcmLen; // subdividing bar
        nextEventTime += stepDuration;

        currentPolyTopStep = (currentPolyTopStep + 1) % polyPatternTop.length;
        currentPolyBottomStep =
            (currentPolyBottomStep + 1) % polyPatternBottom.length;
    } else {
        const stepDuration = interval / (pattern.length || 1);
        nextEventTime += stepDuration;
        currentStep = (currentStep + 1) % (pattern.length || 1);
    }
}

// ====== Notation visuals ======

function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

function buildNotation() {
    clearChildren(notationTrack);
    clearChildren(polyNotationTrack);

    if (currentMode === "simple" || currentMode === "custom") {
        (pattern || []).forEach((step, index) => {
            const div = document.createElement("div");
            div.className = "note-step" + (step.rest ? " rest" : step.accent ? " accent" : " weak");
            div.dataset.index = index;
            const label = document.createElement("div");
            label.className = "note-step-label";
            label.textContent = step.rest
                ? "·"
                : step.accent
                ? "1"
                : "";
            div.appendChild(label);
            notationTrack.appendChild(div);
        });
        polyNotationTrack.classList.add("hidden");
    } else if (currentMode === "polyrhythm") {
        polyNotationTrack.classList.remove("hidden");

        polyPatternTop.forEach((step, index) => {
            const div = document.createElement("div");
            div.className =
                "note-step" + (step.accent ? " accent" : " weak");
            div.dataset.index = index;
            notationTrack.appendChild(div);
        });

        polyPatternBottom.forEach((step, index) => {
            const div = document.createElement("div");
            div.className =
                "note-step secondary" + (step.accent ? " accent" : " weak");
            div.dataset.index = index;
            polyNotationTrack.appendChild(div);
        });
    }
}

function highlightNotationStep(trackEl, index, _lane, isAccent) {
    if (!trackEl) return;
    const steps = trackEl.querySelectorAll(".note-step");
    steps.forEach((el, i) => {
        el.classList.toggle("current", i === index);
    });
}

// ====== Pattern building ======

function buildSimplePattern() {
    const beatsPerBar = Math.max(1, Math.min(16, Number(beatsPerBarInput.value) || 4));
    const subdivision = Number(subdivisionSelect.value) || 1;

    const totalSteps = beatsPerBar * subdivision;
    const newPattern = [];

    for (let i = 0; i < totalSteps; i++) {
        const isAccent = i % subdivision === 0; // first subdivision in beat
        newPattern.push({
            accent: isAccent,
            rest: false,
        });
    }

    pattern = newPattern;

    const noteName = (() => {
        switch (subdivision) {
            case 1:
                return "quarter notes";
            case 2:
                return "8th notes";
            case 3:
                return "triplets";
            case 4:
                return "16th notes";
            default:
                return subdivision + " subdivisions";
        }
    })();

    notationLabel.textContent = `${beatsPerBar}/4 • ${noteName}`;
    buildNotation();
}

function buildCustomPattern() {
    const raw = patternInput.value.trim();
    if (!raw) {
        pattern = [
            { accent: true, rest: false },
            { accent: false, rest: false },
            { accent: false, rest: false },
            { accent: false, rest: false },
        ];
    } else {
        const chars = raw.replace(/\s+/g, "").split("");
        const parsed = chars.map((ch, idx) => {
            if (ch === "x" || ch === "X") {
                return { accent: idx === 0, rest: false };
            }
            if (ch === "-") {
                return { accent: false, rest: false };
            }
            return { accent: false, rest: true }; // '.'
        });
        if (parsed.length === 0) {
            parsed.push({ accent: true, rest: false });
        }
        parsed[0].accent = true; // force bar accent on first
        pattern = parsed;
    }

    notationLabel.textContent = `Custom • ${pattern.length} steps`;
    buildNotation();
}

function buildPolyrhythmPatterns() {
    const top = Math.max(2, Math.min(16, Number(topPolyInput.value) || 3));
    const bottom = Math.max(2, Math.min(16, Number(bottomPolyInput.value) || 2));

    const makePattern = (len) =>
        Array.from({ length: len }, (_, i) => ({
            accent: i === 0,
            rest: false,
        }));

    polyPatternTop = makePattern(top);
    polyPatternBottom = makePattern(bottom);

    notationLabel.textContent = `${top} : ${bottom} polyrhythm`;
    buildNotation();
}

// LCM for polyrhythm scheduling
function gcd(a, b) {
    while (b !== 0) {
        const t = b;
        b = a % b;
        a = t;
    }
    return a;
}
function lcm(a, b) {
    return (a * b) / gcd(a, b);
}

// ====== Transport ======

function startMetronome() {
    initAudioContext();
    if (playing) return;

    playing = true;
    playButton.textContent = "Stop";

    // rebuild pattern
    if (currentMode === "simple") buildSimplePattern();
    else if (currentMode === "polyrhythm") buildPolyrhythmPatterns();
    else buildCustomPattern();

    currentStep = 0;
    currentPolyTopStep = 0;
    currentPolyBottomStep = 0;
    nextEventTime = audioContext.currentTime + 0.1;

    schedulerId = setInterval(scheduler, 100);
}

function stopMetronome() {
    playing = false;
    playButton.textContent = "Start";

    if (schedulerId) {
        clearInterval(schedulerId);
        schedulerId = null;
    }
}

// ====== Event handlers ======

// Start/Stop
playButton.addEventListener("click", () => {
    if (playing) stopMetronome();
    else startMetronome();
});

// Tempo submit + step buttons
tempoInput.addEventListener("change", () => {
    updateTempo(tempoInput.value);
});

tempoStepButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
        const step = Number(btn.dataset.step) || 0;
        updateTempo(tempo + step);
    })
);

// Tap tempo
let tapTimes = [];
tapButton.addEventListener("click", () => {
    const now = performance.now();
    tapTimes.push(now);
    tapTimes = tapTimes.slice(-6); // last 6 taps

    if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const tapTempo = Math.round(60000 / avgMs);
        updateTempo(tapTempo);
    }
});

// Rhythm mode change
document.querySelectorAll('input[name="rhythmMode"]').forEach((input) => {
    input.addEventListener("change", (e) => {
        currentMode = e.target.value;
        simpleControls.classList.toggle("hidden", currentMode !== "simple");
        polyControls.classList.toggle("hidden", currentMode !== "polyrhythm");
        customControls.classList.toggle("hidden", currentMode !== "custom");

        if (currentMode === "simple") buildSimplePattern();
        else if (currentMode === "polyrhythm") buildPolyrhythmPatterns();
        else buildCustomPattern();
    });
});

// Simple meter change
beatsPerBarInput.addEventListener("change", () => {
    buildSimplePattern();
});
subdivisionSelect.addEventListener("change", () => {
    buildSimplePattern();
});

// Polyrhythm fields
topPolyInput.addEventListener("change", () => {
    buildPolyrhythmPatterns();
});
bottomPolyInput.addEventListener("change", () => {
    buildPolyrhythmPatterns();
});

// Custom pattern field
patternInput.addEventListener("input", () => {
    buildCustomPattern();
});

// Sound controls
soundSelect.addEventListener("change", () => {
    soundPreset = soundSelect.value;
});
accentVolumeSlider.addEventListener("input", () => {
    accentGainLevel = Number(accentVolumeSlider.value);
});
weakVolumeSlider.addEventListener("input", () => {
    weakGainLevel = Number(weakVolumeSlider.value);
});

// ====== Initial setup ======

updateTempo(tempo);
buildSimplePattern();