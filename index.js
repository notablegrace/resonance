var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _this = this;
var Notion = require("@neurosity/notion").Notion;
var Client = require("node-osc").Client;
require("dotenv").config();
// TODO
// Have size adjust in a range, to avoid getting too small / hitting eyes
// Fix the occasional glitches (from OSC? From laser? I need to know)
// Scaling the jitter size to account for the projection size
// If signal quality below a threshold, make everything red
// CONFIG
var oscTargetIP = "192.168.1.163"; // Make this IP of machine I'm sending to
var oscTargetPort = 6666;
var refreshRate = 60; // How many times to send new values per second
// const maxRotationSpeed = 0.5 // Slowed down per Calm value
var movingAverageSampleSize = 2048;
// STATE
// let lastCalm = 0 // Last value from EEG
// let nextCalm = 0 // Next value from EEG
// let currentCalm = 0 // Value in animation
// let lastFocus = 0
// let nextFocus = 0
// let currentFocus = 0
var rawMovingAverageF5 = [];
var rawMovingAverageF6 = [];
var movingAverageF5 = 0;
var movingAverageF6 = 0;
// input: array of 16 numbers that represent data for 1/16th of second for a given electrode, sample size
// output: every time you have acccumulated sample size of numbers, output average.
// pop the stack when new data points arrive, keep calculating
function updateMovingAverageData(existingData, movingAverageSampleSize, newData) {
    if (existingData.length < movingAverageSampleSize) {
        return existingData.concat(newData);
        // return [...existingData, ...newData]
    }
    else {
        return __spreadArray(__spreadArray([], existingData.slice(16), true), newData, true);
    }
}
var average = function (array) { return array.reduce(function (a, b) { return a + b; }) / array.length; };
var badSignal = false;
var calmAnimFrame = 0; // On a scale of 0 to refreshRate
var focusAnimFrame = 0; // On a scale of 0 to refreshRate
var currentRotation = 0; // Scale of 0-100
var client = new Client(oscTargetIP, oscTargetPort);
// Sophy's laser controller IP is 192.168.1.162
// const client = new Client('127.0.0.1', 3333); (my own IP)
// Size control OSC path: /beyond/master/livecontrol/size
// Size control OSC path: /beyond/master/livecontrol/size
// Size is controlled via integers between 1-200
// Fx controlled via integers 1-100
// /beyond/master/livecontrol/fx1action
// Neurosity setup
var deviceId = process.env.DEVICE_ID || "";
var email = process.env.EMAIL || "";
var password = process.env.PASSWORD || "";
var verifyEnvs = function (email, password, deviceId) {
    var invalidEnv = function (env) {
        return env === "" || env === 0;
    };
    if (invalidEnv(email) || invalidEnv(password) || invalidEnv(deviceId)) {
        console.error("Please verify deviceId, email and password are in .env file, quitting...");
        process.exit(0);
    }
};
verifyEnvs(email, password, deviceId);
console.log("".concat(email, " attempting to authenticate to ").concat(deviceId));
var notion = new Notion({
    deviceId: deviceId
});
// ANIMATION / TRANSITIONS
function easeInOutSine(x) {
    return -(Math.cos(Math.PI * x) - 1) / 2;
}
// MAIN
var main = function () { return __awaiter(_this, void 0, void 0, function () {
    var mainInterval;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, notion
                    .login({
                    email: email,
                    password: password
                })["catch"](function (error) {
                    console.log(error);
                    throw new Error(error);
                })];
            case 1:
                _a.sent();
                console.log("Logged in");
                // Set up the hook to brainwaves. Raw brainwaves is 16 chunks of data per second
                notion.brainwaves("raw").subscribe(function (brainwaves) {
                    // Update arrays the moving averages are calculated from
                    rawMovingAverageF5 = updateMovingAverageData(rawMovingAverageF5, movingAverageSampleSize, brainwaves.data[2]);
                    rawMovingAverageF6 = updateMovingAverageData(rawMovingAverageF6, movingAverageSampleSize, brainwaves.data[5]);
                    // Calculate averages for each electrode based on the above
                    movingAverageF5 = average(rawMovingAverageF5);
                    movingAverageF6 = average(rawMovingAverageF6);
                    // Calculate symmetry between F5 and F6
                    var F5F6Balance = movingAverageF5 / movingAverageF6;
                    console.log(F5F6Balance);
                    //
                    //
                });
                mainInterval = setInterval(function () {
                    // Increment frame count for animation
                    calmAnimFrame <= refreshRate ? calmAnimFrame++ : null;
                    focusAnimFrame <= refreshRate ? focusAnimFrame++ : null;
                    // Get absolute percent of current animation
                    var currentCalmAnimProgress = (calmAnimFrame / refreshRate).toFixed(3);
                    var currentFocusAnimProgress = (focusAnimFrame / refreshRate).toFixed(3);
                    // Turn absolute percent into nicely animated percent
                    var smoothedCalmAnimProgress = easeInOutSine(currentCalmAnimProgress);
                    var smoothedFocusAnimProgress = easeInOutSine(currentFocusAnimProgress);
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
                return [2 /*return*/];
        }
    });
}); };
main();
