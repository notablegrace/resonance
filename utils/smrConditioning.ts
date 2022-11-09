import { Notion } from "@neurosity/notion";
import { deviceId } from "./authentication";

const {
  average,
  get_amplitude,
  reward,
  authenticate,
} = require("./utils/functions");
const { electrode } = require("config.ts");

let smrAmplitudes = [];
let thetaAmplitudes = [];
let baselineSmrAmplitudes = [];
let baselineThetaAmplitudes = [];
let succeededSmrCount = 0;
let succeededThetaCount = 0;
let smrThreshold = 0; // mV
let thetaThreshold = 10; // mV

export const smrConditioning = async () => {
  const notion = new Notion({
    deviceId,
  });
  authenticate(notion);
  notion.brainwaves("psd").subscribe((brainwaves) => {
    if (!("psd" in brainwaves)) {
      throw Error;
    }
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

    smrAmplitudes.push(smrAmplitude);
    thetaAmplitudes.push(thetaAmplitude);

    baselineSmrAmplitudes.push(smrAmplitude);
    baselineThetaAmplitudes.push(thetaAmplitude);
    succeededSmrCount += smrAmplitude > smrThreshold ? 1 : 0;
    succeededThetaCount += thetaAmplitude < thetaThreshold ? 1 : 0;

    if (smrAmplitudes.length == 4) {
      const smrAverage = average(smrAmplitudes);
      const thetaAverage = average(thetaAmplitudes);
      smrThreshold = smrAverage + 0.001;
      thetaThreshold = thetaAverage - 0.001;
      if (succeededSmrCount >= 3 && succeededThetaCount >= 3) {
        reward(true);
      } else {
        reward(false);
      }
      console.log("===========");
      console.log(
        "REWARD GIVEN: ",
        succeededSmrCount >= 3 && succeededThetaCount >= 3
      );
      console.log(
        "Total baseline smr amplitude: ",
        average(baselineSmrAmplitudes)
      );
      console.log(
        "Total baseline theta amplitude: ",
        average(baselineThetaAmplitudes)
      );
      console.log("succeededSmrCount: ", succeededSmrCount);
      console.log("succeededThetaCount: ", succeededThetaCount);
      console.log("===========");

      smrAmplitudes = [];
      thetaAmplitudes = [];
      succeededSmrCount = 0;
      succeededThetaCount = 0;
    }

    console.log("=========== BLOCK ===========");
    console.log("smrAmplitude", smrAmplitude);
    console.log("smrThreshold", smrThreshold);
    console.log("exceeds smr threshold: ", smrAmplitude > smrThreshold);
    console.log("thetaAmplitude", thetaAmplitude);
    console.log("thetaThreshold", thetaThreshold);
    console.log("below theta threshold: ", smrAmplitude > smrThreshold);
    console.log("=========== END BLOCK ===========");
  });
};
