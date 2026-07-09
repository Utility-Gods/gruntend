import type { GeneratedCodePlan } from "gruntend/generate";

const htmlHelpers = `function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}
function renderMenuItem(item) {
  var itemPath = "/menus/" + item.menuId + "/items/" + item.itemId;
  return '<article class="surface-item">' +
    '<div><strong>' + escapeHtml(item.name) + '</strong>' +
    '<span>$' + item.price.toFixed(2) + ' · ' + escapeHtml(item.tags.join(", ") || "no tags") + '</span></div>' +
    '<details class="surface-dropdown"><summary>Actions</summary><div class="surface-dropdown-menu">' +
    '<button type="button" gr-href="' + itemPath + '/actions/view">View</button>' +
    '<button type="button" gr-href="' + itemPath + '/actions/duplicate">Duplicate</button>' +
    '<button type="button" gr-href="' + itemPath + '/actions/delete">Delete</button>' +
    '</div></details>' +
    '</article>';
}
function renderMenuItemsSurface(title, items) {
  var html = '<div class="surface-card"><p class="surface-text">' + escapeHtml(title) + '</p><div class="surface-list">';
  for (var surfaceIndex = 0; surfaceIndex < items.length; surfaceIndex = surfaceIndex + 1) {
    html = html + renderMenuItem(items[surfaceIndex]);
  }
  html = html + '</div><div class="surface-actions">' +
    '<button type="button" gr-href="/menus">Open menus</button>' +
    '<button type="button" gr-href="/users">Open users</button>' +
    '</div></div>';
  return html;
}
function renderTextSurface(text) {
  return '<div class="surface-card"><p class="surface-text">' + escapeHtml(text) + '</p><div class="surface-actions">' +
    '<button type="button" gr-href="/menus">Open menus</button>' +
    '<button type="button" gr-href="/users">Open users</button>' +
    '</div></div>';
}
`;

export function createMockPlan(task: string): GeneratedCodePlan {
  const normalized = task.toLowerCase();

  if (normalized.includes("selectable") || normalized.includes("menu page")) {
    return {
      summary: "Render a selectable Dinner Menu page with tagged HTML.",
      input: { menuName: "Dinner Menu" },
      code: `
var menusResult = await tools.menus.list({});
var menu = null;

for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  if (menusResult.menus[menuIndex].name === input.menuName) {
    menu = menusResult.menus[menuIndex];
  }
}

if (!menu) {
  return html\`<section class="surface-card"><p class="surface-text">Could not find \${input.menuName}.</p></section>\`;
}

var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
var selected = [];
var duplicatedItems = [];
var status = "Choose items, then run a generated action.";

function toggle(itemId) {
  var index = selected.indexOf(itemId);

  if (index === -1) {
    selected.push(itemId);
    status = selected.length + " selected.";
    return;
  }

  selected.splice(index, 1);
  status = selected.length + " selected.";
}

async function duplicateSelected() {
  if (selected.length === 0) {
    status = "Select at least one item first.";
    return;
  }

  var copied = await parallel(selected.map(function (itemId) {
    return tools.menu.item.duplicate({ menuId: menu.menuId, itemId: itemId });
  }));

  duplicatedItems = copied.map(function (result) {
    return result.item;
  });
  status = "Duplicated " + duplicatedItems.length + " item" + (duplicatedItems.length === 1 ? "" : "s") + ".";
  selected = [];
}

return function render() {
  return html\`<section class="surface-card"><p class="surface-text">\${menu.name}</p><p class="surface-text">\${status}</p><div class="surface-list">\${itemsResult.items.map(function (item) {
    return html\`<button type="button" class=\${selected.indexOf(item.itemId) === -1 ? "surface-item" : "surface-item is-selected"} onclick=\${function () {
      toggle(item.itemId);
    }}><span><strong>\${item.name}</strong><span>\${"$" + item.price.toFixed(2) + " · " + (item.tags.join(", ") || "no tags")}</span></span></button>\`;
  })}</div><div class="surface-actions"><button type="button" onclick=\${duplicateSelected}>Duplicate selected</button></div>\${duplicatedItems.length === 0 ? "" : html\`<div class="surface-list">\${duplicatedItems.map(function (item) {
    return html\`<div class="surface-item"><span><strong>\${item.name}</strong><span>Created by generated UI action</span></span></div>\`;
  })}</div>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("sam rivera") || normalized.includes("user")) {
    return {
      summary: "Create or reuse Sam Rivera as a manager.",
      input: { name: "Sam Rivera", role: "manager" },
      code: `${htmlHelpers}
var created = await tools.users.create({ name: input.name, role: input.role });
return {
  action: "created-user",
  user: created.user,
  html: renderTextSurface("Created or reused " + created.user.name + " as " + created.user.role + ".")
};`,
    };
  }

  if (normalized.includes("vegetarian") || normalized.includes("brunch")) {
    return {
      summary: "Add vegetarian items to the Brunch Menu.",
      input: {
        menuName: "Brunch Menu",
        items: [
          { name: "Garden Frittata", price: 15, tags: ["vegetarian", "eggs"] },
          { name: "Mushroom Hash", price: 14, tags: ["vegetarian", "savory"] },
        ],
      },
      code: `${htmlHelpers}
var menuResult = await tools.menus.create({ name: input.menuName, description: "Weekend brunch specials." });
var createdItems = [];
for (var index = 0; index < input.items.length; index = index + 1) {
  var item = input.items[index];
  var created = await tools.menu.item.create({
    menuId: menuResult.menu.menuId,
    name: item.name,
    price: item.price,
    tags: item.tags,
  });
  createdItems.push(created.item);
}
return {
  action: "added-vegetarian-items",
  menu: menuResult.menu,
  createdCount: createdItems.length,
  items: createdItems,
  html: renderMenuItemsSurface("Created vegetarian menu items.", createdItems)
};`,
    };
  }

  if (normalized.includes("summarize") || normalized.includes("summary")) {
    return {
      summary: "Summarize the current restaurant data.",
      input: {},
      code: `${htmlHelpers}
var menusResult = await tools.menus.list({});
var usersResult = await tools.users.list({});
var itemCount = 0;
for (var index = 0; index < menusResult.menus.length; index = index + 1) {
  var menu = menusResult.menus[index];
  var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
  itemCount = itemCount + itemsResult.items.length;
}
return {
  action: "summarized-restaurant",
  menus: menusResult.menus.length,
  users: usersResult.users.length,
  items: itemCount,
  html: renderTextSurface("Restaurant summary: " + menusResult.menus.length + " menus, " + itemCount + " items, " + usersResult.users.length + " users.")
};`,
    };
  }

  return {
    summary: "Copy Dinner Menu items into Lunch Menu while skipping burgers.",
    input: {
      sourceMenuName: "Dinner Menu",
      targetMenuName: "Lunch Menu",
      excludedItemName: "Smash Burger",
    },
    code: `${htmlHelpers}
var menusResult = await tools.menus.list({});
var sourceMenu = null;
for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  var menu = menusResult.menus[menuIndex];
  if (menu.name === input.sourceMenuName) {
    sourceMenu = menu;
  }
}
if (!sourceMenu) {
  return {
    action: "missing-source-menu",
    menuName: input.sourceMenuName,
    html: renderTextSurface("Could not find source menu " + input.sourceMenuName + ".")
  };
}
var targetResult = await tools.menus.create({
  name: input.targetMenuName,
  description: "Copied from Dinner Menu by the mock planner.",
});
var itemsResult = await tools.menu.items.list({ menuId: sourceMenu.menuId });
var copiedItems = [];
for (var itemIndex = 0; itemIndex < itemsResult.items.length; itemIndex = itemIndex + 1) {
  var item = itemsResult.items[itemIndex];
  if (item.name !== input.excludedItemName) {
    var created = await tools.menu.item.create({
      menuId: targetResult.menu.menuId,
      name: item.name,
      price: item.price,
      tags: item.tags,
    });
    copiedItems.push(created.item);
  }
}
return {
  action: "copied-menu-items",
  sourceMenu: sourceMenu,
  targetMenu: targetResult.menu,
  copiedCount: copiedItems.length,
  items: copiedItems,
  html: renderMenuItemsSurface("Copied menu items into " + targetResult.menu.name + ".", copiedItems)
};`,
  };
}
