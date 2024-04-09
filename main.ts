import { getInputs, run } from "./index.js";
import { setFailed } from "@actions/core";

run(getInputs()).catch((reason) => {
  setFailed(reason);
});
