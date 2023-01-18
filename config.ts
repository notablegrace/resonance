export const oscTargetIP: string = "192.168.1.163";
export const oscTargetPort: number = 6666;
export const refreshRate = 60; // # times to send values per second

export const movingAverageSampleSize: number = 2048;

export enum Setting {
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  MIDDLE = "MIDDLE",
}

export enum Electrode {
  CP3,
  C3,
  F5,
  PO3,
  PO4,
  F6,
  C4,
  CP4,
}

export const Frequency = [
  0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78,
  80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112,
  114, 116, 118, 120, 122, 124, 126,
];
