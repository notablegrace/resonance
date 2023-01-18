import { Notion } from "@neurosity/notion";
import { client } from "./authentication";
import { average, getAmplitude, reward } from "./functions";
import { Electrode } from "../config";

let smrAmplitudes = [];
let thetaAmplitudes = [];
let baselineSmrAmplitudes = [];
let baselineThetaAmplitudes = [];
let succeededSmrCount = 0;
let succeededThetaCount = 0;
let smrThreshold = 0; // mV
let thetaThreshold = 10; // mV

export const smrConditioning = async (notion: Notion) => {
  notion.brainwaves("psd").subscribe((brainwaves) => {
    if (!("psd" in brainwaves)) {
      throw Error;
    }
    const smrAmplitude = getAmplitude(
      brainwaves.psd,
      [Electrode.C3, Electrode.C4],
      [12, 14]
    );
    const thetaAmplitude = getAmplitude(
      brainwaves.psd,
      [Electrode.C3, Electrode.C4],
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
        reward(client, true);
      } else {
        reward(client, false);
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
