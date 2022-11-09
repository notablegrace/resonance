import { oscTargetIP, oscTargetPort } from "../config";

const { Client } = require("node-osc");
require("dotenv").config();

export const client = new Client(oscTargetIP, oscTargetPort);

export const deviceId = process.env.DEVICE_ID || "";
export const email = process.env.EMAIL || "";
export const password = process.env.PASSWORD || "";

export const verifyEnvs = (
  email: string,
  password: string,
  deviceId: string
) => {
  const invalidValue = (value: string) => {
    return value === "";
  };
  if (invalidValue(email) || invalidValue(password) || invalidValue(deviceId)) {
    throw new Error(
      "Please verify deviceId, email and password are in .env file, quitting..."
    );
  }
};

export async function authenticate(notion) {
  verifyEnvs(email, password, deviceId);
  console.log(`${email} attempting to authenticate to ${deviceId}`);
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
  return notion;
}
