import { createGruntendClient } from "gruntend/client";
import { exampleTools } from "./tools.ts";

export const gruntend = createGruntendClient({
  tools: exampleTools,
});
