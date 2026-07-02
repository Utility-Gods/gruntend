import { createGruntendClient } from "gruntend/client";
import { appTools } from "./tools";

export const gruntend = createGruntendClient({
  tools: appTools,
});
