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

enum electrode {
  CP3,
  C3,
  F5,
  PO3,
  PO4,
  F6,
  C4,
  CP4,
}

const freqs = [
  0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78,
  80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112,
  114, 116, 118, 120, 122, 124, 126,
];

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

  smartdatachute();
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

    // console.log(F5F6Balance);

  });

  notion.brainwaves("psd").subscribe((brainwaves) => {
    const smrAmplitude = get_amplitude(
      brainwaves.psd,
      [electrode.C3, electrode.C4],
      [12, 14]
    );
    const thetaAmplitude = get_amplitude(
      brainwaves.psd,
      [electrode.C3, electrode.C4],
      [4, 6]
    );
      
    console.log('smrAmplitude', smrAmplitude);
    console.log('thetaAmplitude', thetaAmplitude);
  })

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

function smartdatachute() {
  // simulates output of notion.brainwaves("powerByBand") for two headsets
  // setInterval(() => {
  //   console.log(
  //     get_amplitude(
  //       sample_transformed_data.psd,
  //       [electrode.C3, electrode.C4],
  //       [12, 14]
  //     ),
  //     get_amplitude(
  //       sample_transformed_data.psd,
  //       [electrode.C3, electrode.C4],
  //       [4, 6]
  //     )
  //   );
  // }, 1000);
}

function get_amplitude(
  psd: Array<number[]>,
  electrodes: electrode[],
  target_freqs: number[]
) {
  let frequency_indexes = [];

  target_freqs.forEach((x) => {
    frequency_indexes.push(freqs.indexOf(x));
  });
  let collected_amplitudes = [];

  electrodes.forEach((electrode) => {
    const electrode_amplitudes = target_freqs.reduce((acc, freq) => {
      return psd[electrode][freq] + acc;
    });

    const electrode_amplitudes_avg = electrode_amplitudes / target_freqs.length;

    collected_amplitudes.push(electrode_amplitudes_avg);
  });

  return (
    collected_amplitudes.reduce((a, b) => a + b) / collected_amplitudes.length
  );
}

var sample_transformed_data = {
  label: "psd",
  freqs: [
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38,
    40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76,
    78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110,
    112, 114, 116, 118, 120, 122, 124, 126,
  ],
  info: {
    notchFrequency: "60Hz",
    samplingRate: 256,
    startTime: 1628197298732,
  },
  psd: [
    [
      98.63572869924877, 278.0499119981597, 396.9075453246308,
      330.93307599602673, 154.4437300666471, 127.381718447909,
      156.28589064508202, 90.27952532968459, 74.02596881179568,
      102.68745491461037, 77.40464372151173, 65.97947493071318,
      93.61333998578448, 70.03755439407374, 47.965913961348285,
      72.11457749610696, 60.14793608854482, 36.43407809513316, 52.5321191045999,
      45.400500672083176, 24.168757651016627, 37.1839936941784,
      35.105296424441036, 14.991272333196237, 17.013079679743214,
      22.931615422127962, 9.64319909169338, 6.95610789706202, 10.48806813349181,
      8.77101666889275, 8.08687117576467, 7.88454615426007, 7.00857990702008,
      9.129752553805993, 7.500414008219254, 6.4966183674128635,
      7.833399187762861, 7.283708613586358, 5.616493707372124,
      7.336663052350952, 6.859592851990316, 6.153804860755752,
      6.618696201331677, 6.837180878389385, 5.7838083130648945,
      6.562155335152424, 6.093398492507891, 6.073406841367065,
      5.9593899491763205, 6.14611107916922, 5.674535238756583,
      6.0774035077156645, 5.656938723201682, 5.892346415487732,
      5.61605742554047, 5.842031463718972, 5.514410378848478, 5.803658958523979,
      5.47172273287992, 5.745739449800702, 5.452574435173335, 5.724439426371041,
      5.4273919360609035, 5.707772456903569,
    ],
    [
      705.0449351206108, 1355.4773207863375, 1795.4768676020658,
      1480.8269991044856, 879.7073135412625, 734.4677613113015,
      691.6145778964477, 482.9726329188916, 463.9458627254311,
      448.9185196251005, 325.3989179173811, 356.7357077059943,
      366.94089924861487, 288.75232488327777, 304.2605284381872,
      301.8930577524112, 237.4042509842181, 248.189270828571,
      244.01379638689255, 177.6237336667693, 172.43627544841166,
      176.69895192953885, 125.52722189861495, 105.15448954029884,
      106.56146701054848, 63.477588704077554, 33.251603187541896,
      42.84498288204394, 23.928294234593277, 9.767390485089537,
      15.03794181419898, 13.965161093202841, 20.844294981525614,
      12.007423569211078, 11.126393885153014, 20.104729878667776,
      12.319226156469027, 10.486815016962693, 17.143209506256614,
      11.132954923524995, 10.62728760663002, 14.463591856614492,
      10.925935011739528, 10.576245202399233, 12.869498809209984,
      10.551373735436435, 10.90154409382562, 11.496161902596342,
      10.59771747532043, 10.626533456022605, 10.982565808529692,
      10.292226858572462, 10.587506870484761, 10.420838952336604,
      10.33846013622055, 10.228524593265222, 10.333151489515492,
      10.081149399888313, 10.23400481786508, 10.046416371678554,
      10.14064797386651, 9.979626942208188, 10.115418833026341,
      9.962197147976129,
    ],
    [
      929.0377610383296, 1793.6811181430987, 2377.6119679334947,
      1958.9102655269323, 1162.3055283149445, 979.7382233236812,
      921.065883147485, 640.2289218688652, 619.3532710184182, 597.9752360209405,
      433.84218492741303, 480.63827859906377, 494.8759497888118,
      388.5592867189369, 408.72806358233913, 403.8696475504568,
      318.0820897599802, 335.6971387951459, 330.1749076377176,
      240.2816149573954, 234.1828700249589, 238.8172342465352,
      168.40453177012395, 141.41297208524767, 143.3763643586936,
      84.85781325822384, 44.693260335642535, 57.99822015732011,
      32.12541610045182, 13.475265334606835, 20.599681672533375,
      19.01837044906831, 28.246044041267428, 16.189180127175323,
      15.41587209212851, 27.05517471975363, 16.903913745426895,
      14.33546383874818, 23.026090510272617, 14.87036823280212,
      14.6068129622348, 19.471383549994453, 14.96633838574153,
      14.387933483886725, 17.466586501671532, 14.355984995364704,
      14.919336874633427, 15.536030663642576, 14.543171342633388,
      14.399423945911408, 15.00275665739408, 13.982397994287624,
      14.474361692225106, 14.126311107434065, 14.160828645624179,
      13.86227555141294, 14.139642435285486, 13.674442534649062,
      14.000882290360456, 13.623523705584073, 13.881719450096554,
      13.533315732597867, 13.84382520692153, 13.508775392377734,
    ],
    [
      461.1411944745596, 865.879891899699, 1150.3297939965412,
      967.6717977233337, 599.5067484775997, 487.7449557189379,
      449.7148527252277, 324.75340665195546, 307.3960653823736,
      289.99356448521917, 218.9307327550319, 241.757776766985,
      249.28709256762335, 206.95217758165205, 213.8552238566172,
      208.04287443336904, 172.16085191285578, 177.8042520513104,
      170.76433578042244, 131.2290615556113, 127.75140879293434,
      125.8563352501824, 94.44550500099892, 81.32600662751962,
      76.33377477822643, 47.53219019300205, 29.403234515228505,
      29.734512582314988, 14.48430634759893, 4.338569856695335,
      7.956256668786119, 7.925904164095972, 12.763456529014546,
      5.823156703304557, 7.213304914646235, 12.53665043042392,
      6.064277734596193, 6.0142267398677225, 10.591216540020291,
      5.491335175417487, 5.995538415704912, 8.41366666249266, 5.354337464315892,
      5.684078918046329, 7.289586947844527, 5.258040775750918,
      5.927892633808341, 6.209024439918837, 5.5308778688068525,
      5.658218846438647, 5.937393602233365, 5.337787715362042,
      5.723456582324143, 5.491309810378187, 5.517788579034077,
      5.3995359451843115, 5.544753793342432, 5.291402564159946,
      5.499716204904763, 5.281561955171903, 5.4342620388212115,
      5.243854533655554, 5.426831995465968, 5.23668469315059,
    ],
    [
      485.28953220351815, 913.8215446531855, 1212.6893063853145,
      1017.6653954348992, 629.0590135927589, 513.8401411331691,
      473.94607162953474, 340.7794194629709, 323.4068209463424,
      304.6140613386581, 227.9530765749002, 253.44275369319936,
      261.96382482250846, 215.95821471824453, 223.2060790303756,
      217.5887331092368, 180.05264499052626, 186.6722683242584,
      178.86415942933493, 135.75616983861607, 132.7145908145038,
      131.7205674261096, 98.13621951582651, 84.22587059556682,
      79.69348482329639, 49.27415323250583, 29.885948066276374,
      31.018207012950032, 15.464201551787149, 4.696597650070098,
      8.680077668220271, 8.409519490488169, 13.587393841532371,
      6.264695355862866, 7.572139679407593, 13.17605643990251,
      6.652754348269858, 6.3465028991975325, 11.306345734652368,
      5.926439990819285, 6.470051702062516, 8.904949649675096, 5.90150761172456,
      6.060485555618185, 7.854198979433359, 5.663406547398727,
      6.4306283909466435, 6.623721018560318, 6.041438452881903,
      6.0442294631002795, 6.444444318919457, 5.721040377425073,
      6.213246144964029, 5.8753004744243755, 6.002696003640614,
      5.774903831465746, 6.026353504659674, 5.663944879598529,
      5.975725903093066, 5.652394044025673, 5.907643067149823,
      5.612177778683849, 5.898257253854689, 5.604260960707902,
    ],
    [
      703.9620591951088, 1348.1617601998341, 1787.817378338989,
      1480.9682977349662, 887.8732586924484, 741.7489045127593,
      696.4862482257432, 486.69267953812624, 464.30488178918847,
      448.10745320129496, 329.6131727268781, 364.1234842222161,
      375.17667115955084, 296.30580382389024, 307.6916385785675,
      303.4585158601969, 241.4840430193035, 253.3373457325428,
      248.14875370587004, 181.8456760420915, 176.16078095306457,
      178.58969714768043, 126.8938114163353, 106.7131960446341,
      106.86715498126117, 63.565099293832944, 33.94124074989405,
      42.78261882478681, 23.418093057211088, 9.598376452708248,
      14.8564635663729, 13.73158527388318, 20.632309203759725,
      11.571312623082235, 11.16199944105178, 19.71697966916169,
      12.151289348370563, 10.27332116826051, 16.93453042721219,
      10.734196078665759, 10.578983816474802, 14.17031151713728,
      10.741999390916682, 10.370828224990875, 12.669038407738478,
      10.290437631963869, 10.794986602960588, 11.204752776686476,
      10.481500894235385, 10.373479646590457, 10.845762801813153,
      10.04623630410688, 10.466118545780976, 10.16324823810254,
      10.225788013632457, 9.975974411529377, 10.21577779934349,
      9.834755780463283, 10.117741157508208, 9.799067226573825,
      10.029038431063377, 9.733625015451048, 10.002552468346979,
      9.71630020598175,
    ],
    [
      753.3573854351718, 1451.3463711535637, 1925.4394750722938,
      1592.2479396735228, 950.1320711729846, 793.4163539564408,
      744.990261771651, 519.4611344925438, 498.6282329256233, 480.4651411728872,
      349.9224396629356, 388.08464608248545, 400.41433150212987,
      314.28699618071386, 328.3871848882801, 325.21671199729667,
      257.08898576447365, 270.0756790958063, 265.56055695000117,
      193.58422699465976, 187.3975181698473, 190.5723885919431,
      134.7850068920377, 113.55417235960783, 114.65352872167782,
      67.97249319078067, 36.07066166066659, 46.193455592634194,
      25.446519462818365, 10.645647869461468, 16.33292205396577,
      15.082694752225358, 22.479081487850554, 12.660457753439347,
      12.331655605615103, 21.469122245638992, 13.259611882976637,
      11.366093905761021, 18.4614508154199, 11.778790555694387,
      11.710458297806564, 15.485077358432786, 11.805213571500564,
      11.446226210170733, 13.887884653568616, 11.334007371207884,
      11.881804314077982, 12.30654501069072, 11.528873716721828,
      11.419099102496702, 11.910897138255397, 11.059631088502826,
      11.505557872713792, 11.178885987141047, 11.242816922347224,
      10.97697117415906, 11.227884136208706, 10.822693801769324,
      11.121177549665633, 10.782078947654583, 11.024368739435461,
      10.711151846144949, 10.995151378799578, 10.691866595209362,
    ],
    [
      367.4136193009799, 826.7329948628463, 1118.3539023221265,
      890.162220791093, 436.1682590608995, 391.4382314784865,
      417.04217210936963, 251.56740893464422, 238.5284921292077,
      267.6000138141995, 168.617128049186, 165.98870799455165,
      200.56943140232212, 129.37112302840023, 126.00839013852573,
      162.39587433692205, 109.20332945126022, 87.00867663058928,
      117.95711115144483, 83.29961985396704, 58.57022651921219,
      86.68284556964056, 63.23057486573713, 22.615043247176825,
      45.79353231282386, 39.94573246684187, 6.411920387449734,
      21.964845928081306, 21.959370088243116, 16.277025835788837,
      16.547064843486048, 15.715335138181468, 16.607457789253704,
      17.537478155658583, 13.336615276197591, 15.835823046176726,
      15.461292461652397, 13.730332854951738, 13.27865408978899,
      14.709605078820157, 12.9045807988706, 13.692853045756497,
      13.258453124525246, 13.287331440282053, 12.481768554519784,
      13.223425784019863, 12.187280042833416, 12.738723198131671,
      12.048047848217715, 12.49122466572343, 11.744286244430379,
      12.342663893673903, 11.552471648965968, 12.117055516659004,
      11.432033986591367, 11.965037193629023, 11.288502743059457,
      11.863912386218576, 11.190384199321217, 11.771734261131785,
      11.131137815008097, 11.71660417394918, 11.08761147894627,
      11.686948260719255,
    ],
  ],
};

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
  a. frequency band : SMR (12-15hz)
  b. electrode(s) : C4 at least to start, potentially others?
  c. symmetry: out of scope for now, revisit later??
3. have code to calculate differential: Grace
4. code brain stimulation: Grace has mp4 files and music, but if we want to use this we need to drop it into touch designer?
5. write copy to coach participants on breathing and meditation, drop into touch designer
6. display signal quality feedback. see https://docs.neurosity.co/docs/reference/#channelquality  
  and maybe this too https://github.com/neurosity/notion-js/blob/master/src/Notion.ts#L791 
  and this https://github.com/neurosity/eeg-pipes#sample 



  fourier transform data

  activity within frequency band


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
