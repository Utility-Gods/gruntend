import { createGenOpenClient } from "../../../mod.ts";
import { exampleTools } from "./tools.ts";

export const genopen = createGenOpenClient({
  tools: exampleTools,
});
