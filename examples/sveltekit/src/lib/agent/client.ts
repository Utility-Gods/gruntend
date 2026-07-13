import { createGruntendClient } from "gruntend-sdk/client";
import { appTools } from "./tools";

export const gruntend = createGruntendClient({
  tools: appTools,
});
