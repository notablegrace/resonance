const { Notion } = require("@neurosity/notion");
const { Client } = require("node-osc");
require("dotenv").config();

// TODO
// Have size adjust in a range, to avoid getting too small / hitting eyes
// Fix the occasional glitches (from OSC? From laser? I need to know)
// Scaling the jitter size to account for the projection size
// If signal quality below a threshold, make everything red

// CONFIG
const oscTargetIP: string = "192.168.1.163"; // Make this IP of machine I'm sending to
const oscTargetPort: number = 6666;
const refreshRate = 60; // How many times to send new values per second
// const maxRotationSpeed = 0.5 // Slowed down per Calm value
const movingAverageSampleSize: number = 2048;

enum setting {
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  MIDDLE = "MIDDLE",
}
// do you want to sync brain waves to match left user, right user, or find common ground?

// STATE
// let lastCalm = 0 // Last value from EEG
// let nextCalm = 0 // Next value from EEG
// let currentCalm = 0 // Value in animation
// let lastFocus = 0
// let nextFocus = 0
// let currentFocus = 0
let rawMovingAverageF5: Array<number> = [];
let rawMovingAverageF6: Array<number> = [];

let movingAverageF5: number = 0;
let movingAverageF6: number = 0;

// input: array of 16 numbers that represent data for 1/16th of second for a given electrode, sample size
// output: every time you have acccumulated sample size of numbers, output average.
// pop the stack when new data points arrive, keep calculating
function updateMovingAverageData(
  existingData: Array<number>,
  movingAverageSampleSize: number,
  newData: Array<number>
): Array<number> {
  if (existingData.length < movingAverageSampleSize) {
    return existingData.concat(newData);
    // return [...existingData, ...newData]
  } else {
    return [...existingData.slice(16), ...newData];
  }
}

// sample https://photos.app.goo.gl/sFHT113jH7ogcC8i6

const average = (array) => array.reduce((a, b) => a + b) / array.length;

let badSignal = false;

let calmAnimFrame = 0; // On a scale of 0 to refreshRate
let focusAnimFrame = 0; // On a scale of 0 to refreshRate
let currentRotation = 0; // Scale of 0-100

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

const verifyEnvs = (email, password, deviceId) => {
  const invalidEnv = (env) => {
    return env === "" || env === 0;
  };
  if (invalidEnv(email) || invalidEnv(password) || invalidEnv(deviceId)) {
    console.error(
      "Please verify deviceId, email and password are in .env file, quitting..."
    );
    process.exit(0);
  }
};
verifyEnvs(email, password, deviceId);

console.log(`${email} attempting to authenticate to ${deviceId}`);

const notion = new Notion({
  deviceId,
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
      password,
    })
    .catch((error) => {
      console.log(error);
      throw new Error(error);
    });
  console.log("Logged in");

  dumbdatachute();
  // Set up the hook to brainwaves. Raw brainwaves is 16 chunks of data per second
  notion.brainwaves("raw").subscribe((brainwaves) => {
    // Update arrays the moving averages are calculated from
    rawMovingAverageF5 = updateMovingAverageData(
      rawMovingAverageF5,
      movingAverageSampleSize,
      brainwaves.data[2]
    );
    rawMovingAverageF6 = updateMovingAverageData(
      rawMovingAverageF6,
      movingAverageSampleSize,
      brainwaves.data[5]
    );

    // Calculate averages for each electrode based on the above
    movingAverageF5 = average(rawMovingAverageF5);
    movingAverageF6 = average(rawMovingAverageF6);

    // Calculate symmetry between F5 and F6
    const F5F6Balance = movingAverageF5 / movingAverageF6;

    console.log(F5F6Balance);

    //

    notion.brainwaves("powerByBand").subscribe((brainwaves) => {
      console.log(brainwaves);
    });
    //
  });

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
    calmAnimFrame <= refreshRate ? calmAnimFrame++ : null;
    focusAnimFrame <= refreshRate ? focusAnimFrame++ : null;

    // Get absolute percent of current animation
    const currentCalmAnimProgress = (calmAnimFrame / refreshRate).toFixed(3);
    const currentFocusAnimProgress = (focusAnimFrame / refreshRate).toFixed(3);

    // Turn absolute percent into nicely animated percent
    const smoothedCalmAnimProgress = easeInOutSine(currentCalmAnimProgress);
    const smoothedFocusAnimProgress = easeInOutSine(currentFocusAnimProgress);

    // // Turned smoothed progress percent into absolute number
    // const totalChangeInCalm = nextCalm - lastCalm
    // const totalChangeInFocus = nextFocus - lastFocus

    // const animChangeInCalm = totalChangeInCalm * smoothedCalmAnimProgress
    // const animChangeInFocus = totalChangeInFocus * smoothedFocusAnimProgress

    // currentCalm = currentCalm != nextCalm
    //   ? parseFloat((animChangeInCalm + lastCalm).toFixed(4))
    //   : currentCalm
    // currentFocus = currentFocus != nextFocus
    //   ? parseFloat((animChangeInFocus + lastFocus).toFixed(4))
    //   : currentFocus

    // const invertedCalm = -(currentCalm - 1) // invert for ease of use

    // // Rotate the shape, slightly affected by calm levels
    // // currentRotation = currentRotation <= 100 ? currentRotation + rotationSpeed : 0
    // currentRotation = currentRotation <= 100 ? currentRotation + (maxRotationSpeed * invertedCalm) : 0

    // const focusValue = currentFocus * 200

    // // BROADCAST OSC

    // // Jitter of shape, from Calm
    // client.send('/calm', invertedCalm, () => {});

    // // Size of shape, from Focus
    // client.send('/focus', currentFocus, () => {});

    // // Rotation of shape
    // client.send('/beyond/master/livecontrol/rotoz', invertedCalm * 42, () => {});

    // Color going all red
    // client.send('/beyond/master/livecontrol/COLORREDWHATEVER', badSignal ? 1 : 0, () => {});
    // Ooooh, I could also have the crown vibrate in lil bursts w/haptics api
  }, 950 / refreshRate);
};

main();

function find_separation(input: Array<number>, config: setting): Array<number> {
  // input: powerByBand for each user
  // calculate the separation between each user
  // output: return target powerByBand for each user
  return [];
}

function stimulate(target): Array<number> {
  // input: target powerByBand for each user
  // output: stimulus for each user
  // auditory? visals?
  return [];
}

function dumbdatachute() {
  // simulates output of notion.brainwaves("powerByBand") for two headsets
  setInterval(() => {
    console.log(sample);
  }, 1000);
}

/*  
Channels names for each electrode
    channelNames: [
      'CP3', 'C3',
      'F5',  'PO3',
      'PO4', 'F6',
      'C4',  'CP4'
    ],

  important channels to us: [0,5] (f5, f6)

1. understand how to effectively stimulate brain: Sam + Grace
2. understand targets and benefits of each target: Sam + Grace
  a. frequency bands
  b. electrodes
  c. symmetry
3. have code to calculate differential: Grace
4. code brain stimulation: output OSC: Grace
5. code brain stimulation: input stimulus: Sam

*/

var sample = [
  {
    label: "powerByBand",
    data: {
      alpha: [
        0.4326838933650053, 0.7011913998347046, 1.3717684682104212,
        0.4043711439234614, 0.4276277910286375, 0.7343967679911133,
        0.4643529443786634, 0.5012185195340365,
      ],
      beta: [
        1.0473270376446968, 0.6565360935142369, 0.9905849734272257,
        0.4167252084581245, 0.5812834985846604, 0.9092642713573444,
        0.9963075404421067, 1.0495665446734443,
      ],
      delta: [
        0.46131690566460004, 1.0030278320362798, 0.8563781797682917,
        0.2911634678359473, 0.5829804845703581, 0.6714666592936025,
        0.37730719195446316, 1.0851178080710937,
      ],
      gamma: [
        0.22648773160183822, 0.2171827127990081, 0.2626969784220435,
        0.16349594919353772, 0.17327387900192714, 0.18990085940799623,
        0.22908540295491436, 0.2537584109981627,
      ],
      theta: [
        0.6434504807739541, 0.936240328507981, 0.8679595766147628,
        0.23662065697316603, 0.6048174207817718, 0.816112075629094,
        0.3367745804938397, 1.1043745310136739,
      ],
    },
  },
  {
    label: "powerByBand",
    data: {
      alpha: [
        0.4326838933650053, 0.7011913998347046, 1.3717684682104212,
        0.4043711439234614, 0.4276277910286375, 0.7343967679911133,
        0.4643529443786634, 0.5012185195340365,
      ],
      beta: [
        1.0473270376446968, 0.6565360935142369, 0.9905849734272257,
        0.4167252084581245, 0.5812834985846604, 0.9092642713573444,
        0.9963075404421067, 1.0495665446734443,
      ],
      delta: [
        0.46131690566460004, 1.0030278320362798, 0.8563781797682917,
        0.2911634678359473, 0.5829804845703581, 0.6714666592936025,
        0.37730719195446316, 1.0851178080710937,
      ],
      gamma: [
        0.22648773160183822, 0.2171827127990081, 0.2626969784220435,
        0.16349594919353772, 0.17327387900192714, 0.18990085940799623,
        0.22908540295491436, 0.2537584109981627,
      ],
      theta: [
        0.6434504807739541, 0.936240328507981, 0.8679595766147628,
        0.23662065697316603, 0.6048174207817718, 0.816112075629094,
        0.3367745804938397, 1.1043745310136739,
      ],
    },
  },
];
