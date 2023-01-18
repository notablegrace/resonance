import { Electrode, Frequency, Setting } from "../config";

export const average = (array) => array.reduce((a, b) => a + b) / array.length;

export function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function reward(client, yes: boolean) {
  /* 
    Whether or not to reward the user
    yes: boolean
    client: osc client
  */
  if (yes) {
    console.log("rewarding");
    client.send("/reward", 1, () => {});
  } else {
    console.log("not rewarding");
    client.send("/reward", 0, () => {});
  }
}

export function getAmplitude(
  psd: Array<number[]>,
  Electrodes: Electrode[],
  targetFrequencies: number[]
) {
  const frequencyIndexes = [];
  targetFrequencies.forEach((x) => {
    frequencyIndexes.push(Frequency.indexOf(x));
  });
  const collectedAmplitudes = [];

  Electrodes.forEach((Electrode) => {
    const ElectrodeAmplitudes = targetFrequencies.reduce((acc, freq) => {
      return psd[Electrode][freq] + acc;
    });

    const ElectrodeAmplitudesAverage =
      ElectrodeAmplitudes / targetFrequencies.length;

    collectedAmplitudes.push(ElectrodeAmplitudesAverage);
  });

  return (
    collectedAmplitudes.reduce((a, b) => a + b) / collectedAmplitudes.length
  );
}

export function find_separation(
  input: Array<number>,
  config: Setting
): Array<number> {
  // input: powerByBand for each user
  // calculate the separation between each user
  // output: return target powerByBand for each user
  // config: setting
  return [];
}

export function stimulate(target): Array<number> {
  // input: target powerByBand for each user
  // output: stimulus for each user
  // auditory? visals?
  return [];
}
