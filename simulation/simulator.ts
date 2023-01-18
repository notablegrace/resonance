import { samplePowerSpectralDensity } from "./PSD";

class MockHeadset {
  constructor() {
    this.connect();
  }

  connect(): void {
    console.log("Headset connected");
  }

  disconnect(): void {
    console.log("Headset disconnected");
  }

  /**
   * @returns output of notion.brainwaves("powerByBand") every second
   */
  mockPowerByBand(): void {
    setInterval(() => {
      console.log(samplePowerSpectralDensity);
    }, 1000);
  }
}
