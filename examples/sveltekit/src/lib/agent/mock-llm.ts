export interface MockPlannerRequest {
  readonly prompt: string;
}

export interface MockPlannerResponse {
  readonly summary: string;
  readonly code: string;
  readonly input: Record<string, unknown>;
}

export async function generateMockCodePlan(request: MockPlannerRequest): Promise<MockPlannerResponse> {
  const prompt = request.prompt.trim();
  const lower = prompt.toLowerCase();
  const quoted = [...prompt.matchAll(/["“”']([^"“”']+)["“”']/g)].map((match) => match[1]);

  if (lower.includes("copy") || lower.includes("duplicate")) {
    const sourceMenuName = quoted[0] ?? "Dinner Menu";
    const targetMenuName = quoted[1] ?? "Lunch Menu";

    return {
      summary: `Copy items from ${sourceMenuName} into ${targetMenuName}.`,
      input: { sourceMenuName, targetMenuName },
      code: copyMenuItemsPlan,
    };
  }

  if (lower.includes("vegetarian") || lower.includes("veggie")) {
    const targetMenuName = quoted[0] ?? "Brunch Menu";

    return {
      summary: `Add vegetarian items to ${targetMenuName}.`,
      input: {
        targetMenuName,
        items: [
          { name: "Charred Broccoli Bowl", price: 15, tags: ["vegetarian", "seasonal"] },
          { name: "Mushroom Tartine", price: 13, tags: ["vegetarian"] },
          { name: "Crispy Halloumi Salad", price: 14, tags: ["vegetarian", "salad"] },
        ],
      },
      code: addVegetarianItemsPlan,
    };
  }

  if (lower.includes("user") || lower.includes("manager") || lower.includes("chef")) {
    const userName = quoted[0] ?? extractNameAfter(prompt, "user") ?? "Jordan Lee";
    const role = lower.includes("chef") ? "chef" : lower.includes("owner") ? "owner" : "manager";

    return {
      summary: `Create or reuse ${userName} as ${role}.`,
      input: { userName, role },
      code: createUserPlan,
    };
  }

  return {
    summary: "Summarize current menus and users.",
    input: {},
    code: summaryPlan,
  };
}

const copyMenuItemsPlan = `
const menus = await tools.menus.list({});
let source = null;
let target = null;

for (let index = 0; index < menus.menus.length; index += 1) {
  const menu = menus.menus[index];
  if (menu.name.toLowerCase() === input.sourceMenuName.toLowerCase()) {
    source = menu;
  }
  if (menu.name.toLowerCase() === input.targetMenuName.toLowerCase()) {
    target = menu;
  }
}

if (!source) {
  return {
    action: "missing_source_menu",
    message: "Could not find source menu " + input.sourceMenuName,
  };
}

if (!target) {
  const createdTarget = await tools.menus.create({
    name: input.targetMenuName,
    description: "Created by copying items from " + source.name,
    ownerUserId: source.ownerUserId,
  });
  target = createdTarget.menu;
}

const sourceItems = await tools.menu.items.list({ menuId: source.menuId });
const created = await parallel(
  sourceItems.items.map((item) =>
    tools.menu.item.create({
      menuId: target.menuId,
      name: item.name,
      price: item.price,
      tags: item.tags,
    })
  )
);

return {
  action: "copied_menu_items",
  sourceMenu: source.name,
  targetMenu: target.name,
  createdItems: created.map((result) => result.item.name),
};
`;

const addVegetarianItemsPlan = `
const menus = await tools.menus.list({});
let target = null;

for (let index = 0; index < menus.menus.length; index += 1) {
  const menu = menus.menus[index];
  if (menu.name.toLowerCase() === input.targetMenuName.toLowerCase()) {
    target = menu;
  }
}

if (!target) {
  const createdTarget = await tools.menus.create({
    name: input.targetMenuName,
    description: "Created for vegetarian specials.",
  });
  target = createdTarget.menu;
}

const created = await parallel(
  input.items.map((item) =>
    tools.menu.item.create({
      menuId: target.menuId,
      name: item.name,
      price: item.price,
      tags: item.tags,
    })
  )
);

return {
  action: "added_vegetarian_items",
  menu: target.name,
  createdItems: created.map((result) => result.item.name),
};
`;

const createUserPlan = `
const users = await tools.users.list({});

for (let index = 0; index < users.users.length; index += 1) {
  const user = users.users[index];
  if (user.name.toLowerCase() === input.userName.toLowerCase()) {
    return {
      action: "reused_user",
      user,
    };
  }
}

const created = await tools.users.create({
  name: input.userName,
  role: input.role,
});

return {
  action: "created_user",
  user: created.user,
};
`;

const summaryPlan = `
const menus = await tools.menus.list({});
const users = await tools.users.list({});

return {
  action: "summary",
  menuCount: menus.menus.length,
  userCount: users.users.length,
  menus: menus.menus.map((menu) => menu.name),
  users: users.users.map((user) => user.name),
};
`;

function extractNameAfter(prompt: string, marker: string): string | undefined {
  const lower = prompt.toLowerCase();
  const index = lower.indexOf(marker);
  if (index === -1) return undefined;

  const afterMarker = prompt.slice(index + marker.length).replace(/named|called|as/gi, "").trim();
  return afterMarker.length > 0 ? afterMarker : undefined;
}
