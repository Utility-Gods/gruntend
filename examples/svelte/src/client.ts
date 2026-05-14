import { createGenOpenClient } from "../../../mod.ts";
import { toolRegistry, type AppContext } from "./tools.ts";

export const appContext: AppContext = {
  authToken: "demo-auth-token",
  tenantId: "restaurant-demo",
};

export const genopen = createGenOpenClient({
  registry: toolRegistry,
  context: appContext,
});
