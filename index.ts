// import { smartdatachute } from "./simulator";
import { authenticate, deviceId } from "./utils/authentication";
import { smrConditioning } from "./utils/smrConditioning";

const { Notion } = require("@neurosity/notion");

const main = async () => {
  const notion = new Notion({
    deviceId,
  });
  authenticate(notion);
  smrConditioning(notion);
};

main();
