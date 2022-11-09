import { electrode, freqs, setting } from "../config";

const average = (array) => array.reduce((a, b) => a + b) / array.length;

export function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function reward(client, yes: boolean) {
  if (yes) {
    console.log("reward");
    client.send("/reward", 1, () => {});
  } else {
    console.log("no reward");
    client.send("/reward", 0, () => {});
  }
}

export function get_amplitude(
  psd: Array<number[]>,
  electrodes: electrode[],
  target_freqs: number[]
) {
  const frequency_indexes = [];
  target_freqs.forEach((x) => {
    frequency_indexes.push(freqs.indexOf(x));
  });
  const collected_amplitudes = [];

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

export function find_separation(
  input: Array<number>,
  config: setting
): Array<number> {
  // input: powerByBand for each user
  // calculate the separation between each user
  // output: return target powerByBand for each user
  return [];
}

export function stimulate(target): Array<number> {
  // input: target powerByBand for each user
  // output: stimulus for each user
  // auditory? visals?
  return [];
}
