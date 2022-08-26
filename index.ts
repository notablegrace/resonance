const { Notion } = require("@neurosity/notion");
const { Client } = require("node-osc");
require("dotenv").config();

// TODO
// Have size adjust in a range, to avoid getting too small / hitting eyes
// Fix the occasional glitches (from OSC? From laser? I need to know)
// Scaling the jitter size to account for the projection size
// If signal quality below a threshold, make everything red


// CONFIG
const oscTargetIP = '192.168.1.163' // Make this IP of machine I'm sending to
const oscTargetPort = 6666
const refreshRate = 60 // How many times to send new values per second
const maxRotationSpeed = 0.5 // Slowed down per Calm value


// STATE
let lastCalm = 0 // Last value from EEG
let nextCalm = 0 // Next value from EEG
let currentCalm = 0 // Value in animation
let lastFocus = 0
let nextFocus = 0
let currentFocus = 0

let badSignal = false

let calmAnimFrame = 0 // On a scale of 0 to refreshRate
let focusAnimFrame = 0 // On a scale of 0 to refreshRate
let currentRotation = 0 // Scale of 0-100

const client = new Client(oscTargetIP, oscTargetPort); 
// Sophy's laser controller IP is 192.168.1.162
// const client = new Client('127.0.0.1', 3333); (my own IP)
// Size control OSC path: /beyond/master/livecontrol/size
// Size control OSC path: /beyond/master/livecontrol/size
// Size is controlled via integers between 1-200
// Fx controlled via integers 1-100
// /beyond/master/livecontrol/fx1action

// Neurosity setup
const deviceId = process.env.DEVICE_ID || "";
const email = process.env.EMAIL || "";
const password = process.env.PASSWORD || "";

const verifyEnvs = (email: string, password: string, deviceId: string) => {
  const invalidEnv = (env) => {
    return env === "" || env === 0;
  };
  if (
    invalidEnv(email) ||
    invalidEnv(password) ||
    invalidEnv(deviceId)
  ) {
    console.error(
      "Please verify deviceId, email and password are in .env file, quitting..."
    );
    process.exit(0);
  }
};
verifyEnvs(email, password, deviceId);

console.log(`${email} attempting to authenticate to ${deviceId}`);

const notion = new Notion({
  deviceId
});


// ANIMATION / TRANSITIONS
function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}


// MAIN
const main = async () => {
  await notion
    .login({
      email,
      password
    })
    .catch((error) => {
      console.log(error);
      throw new Error(error);
    });
  console.log("Logged in");
  
  // Subscribe to Calm and Focus levels, delivered once per second ish
  // notion.calm().subscribe((calm) => {

  //   lastCalm = currentCalm
  //   nextCalm = parseFloat(calm.probability.toFixed(4))
  //   calmAnimFrame = 0

  //   client.send('/calm', (-1 * (calm.probability.toFixed(3)*100)) + 100, () => {
  //     // client.close();
  //   });

  //   // Set lastCalm as whatever the current value is
  // });
  // notion.focus().subscribe((focus) => {

  //   lastFocus = currentFocus
  //   nextFocus = parseFloat(focus.probability.toFixed(4))
  //   focusAnimFrame = 0
  //   // console.log("from ", lastFocus, " to ", nextFocus)

  //   client.send('/focus', focus.probability.toFixed(3)*200, () => {
  //     // client.close();
  //   });
  // });
  // notion.signalQuality().subscribe((signal) => {
  //   badSignal = signal < 0.7 THIS DOESN'T WORK, IT OUTPUTS AN ARRAY
  // })

  // Set an interval to send new data per refresh rate
  var mainInterval = setInterval(() => {
    // Increment frame count for animation
    calmAnimFrame <= refreshRate ? calmAnimFrame++ : null
    focusAnimFrame <= refreshRate ? focusAnimFrame++ : null

    // Get absolute percent of current animation
    const currentCalmAnimProgress = (calmAnimFrame/refreshRate).toFixed(3)
    const currentFocusAnimProgress = (focusAnimFrame/refreshRate).toFixed(3)

    // Turn absolute percent into nicely animated percent
    const smoothedCalmAnimProgress = easeInOutSine(currentCalmAnimProgress)
    const smoothedFocusAnimProgress = easeInOutSine(currentFocusAnimProgress)


    // Turned smoothed progress percent into absolute number
    const totalChangeInCalm = nextCalm - lastCalm
    const totalChangeInFocus = nextFocus - lastFocus

    const animChangeInCalm = totalChangeInCalm * smoothedCalmAnimProgress
    const animChangeInFocus = totalChangeInFocus * smoothedFocusAnimProgress

    currentCalm = currentCalm != nextCalm 
      ? parseFloat((animChangeInCalm + lastCalm).toFixed(4))
      : currentCalm
    currentFocus = currentFocus != nextFocus 
      ? parseFloat((animChangeInFocus + lastFocus).toFixed(4))
      : currentFocus

    const invertedCalm = -(currentCalm - 1) // invert for ease of use

    // Rotate the shape, slightly affected by calm levels
    // currentRotation = currentRotation <= 100 ? currentRotation + rotationSpeed : 0
    currentRotation = currentRotation <= 100 ? currentRotation + (maxRotationSpeed * invertedCalm) : 0


    const focusValue = currentFocus * 200

    // BROADCAST OSC

    // Jitter of shape, from Calm
    client.send('/calm', invertedCalm, () => {});

    // Size of shape, from Focus
    client.send('/focus', currentFocus, () => {});

    // Rotation of shape
    client.send('/beyond/master/livecontrol/rotoz', invertedCalm * 42, () => {});

    // Color going all red
    // client.send('/beyond/master/livecontrol/COLORREDWHATEVER', badSignal ? 1 : 0, () => {});
    // Ooooh, I could also have the crown vibrate in lil bursts w/haptics api

  }, (950/refreshRate))
};

main();


