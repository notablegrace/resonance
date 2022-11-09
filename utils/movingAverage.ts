// import { Notion } from "@neurosity/notion";
// import { deviceId } from "../config";
// import { authenticate } from "./functions";

export function updateMovingAverageData(
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

let rawMovingAverageF5: Array<number> = [];
let rawMovingAverageF6: Array<number> = [];

let movingAverageF5: number = 0;
let movingAverageF6: number = 0;

// const movingAverage = async () => {
//   const notion = new Notion({
//     deviceId,
//   });
//   authenticate(notion);
//   notion.brainwaves("raw").subscribe((brainwaves) => {
//     // Update arrays the moving averages are calculated from
//     rawMovingAverageF5 = updateMovingAverageData(
//       rawMovingAverageF5,
//       movingAverageSampleSize,
//       brainwaves.data[2]
//     );
//     rawMovingAverageF6 = updateMovingAverageData(
//       rawMovingAverageF6,
//       movingAverageSampleSize,
//       brainwaves.data[5]
//     );

//     // Calculate averages for each electrode based on the above
//     movingAverageF5 = average(rawMovingAverageF5);
//     movingAverageF6 = average(rawMovingAverageF6);

//     // Calculate symmetry between F5 and F6
//     const F5F6Balance = movingAverageF5 / movingAverageF6;

//     // console.log(F5F6Balance);
//   });

// };
