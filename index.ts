import { smartdatachute } from "./test_data";
import { authenticate, deviceId } from "./utils/authentication";

const { Notion } = require("@neurosity/notion");
const main = async () => {
  const notion = new Notion({
    deviceId,
  });
  authenticate(notion);
  smartdatachute();
};

main();
