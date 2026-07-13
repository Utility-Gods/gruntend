import type { GeneratedCodePlan } from "gruntend-sdk/generate";

export function createMockPlan(task: string): GeneratedCodePlan {
  const normalized = task.toLowerCase();

  if (normalized.includes("price") && normalized.includes("20%")) {
    return {
      summary: "Preview and confirm a 20% increase for items under $10.",
      input: { maximumPrice: 10, multiplier: 1.2 },
      code: `
var menusResult = await tools.menus.list({});
var previewItems = [];
for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  var menu = menusResult.menus[menuIndex];
  var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
  for (var itemIndex = 0; itemIndex < itemsResult.items.length; itemIndex = itemIndex + 1) {
    var item = itemsResult.items[itemIndex];
    if (item.price < input.maximumPrice) {
      previewItems.push({
        menuName: menu.name,
        item: item,
        beforePrice: item.price,
        afterPrice: Math.round(item.price * input.multiplier * 100) / 100,
        updated: null
      });
    }
  }
}
var status = "Preview only. No prices have changed.";
var confirmed = false;
async function confirmPriceIncrease() {
  status = "Applying confirmed price changes...";
  var updated = await Promise.all(previewItems.map(function (entry) {
    return tools.menu.item.update({
      menuId: entry.item.menuId,
      itemId: entry.item.itemId,
      price: entry.afterPrice
    });
  }));
  previewItems = previewItems.map(function (entry, index) {
    return {
      menuName: entry.menuName,
      item: entry.item,
      beforePrice: entry.beforePrice,
      afterPrice: entry.afterPrice,
      updated: updated[index].item
    };
  });
  confirmed = true;
  status = updated.length + " confirmed price " + (updated.length === 1 ? "change" : "changes") + " applied.";
}
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Items under $10: 20% price review</h2><p class="surface-muted">\${status}</p><table class="surface-table"><thead><tr><th>Menu</th><th>Item</th><th>Before</th><th>After</th></tr></thead><tbody>\${previewItems.map(function (entry) {
    return html\`<tr><td>\${entry.menuName}</td><td>\${entry.item.name}</td><td>\${"$" + entry.beforePrice.toFixed(2)}</td><td>\${"$" + entry.afterPrice.toFixed(2)}</td></tr>\`;
  })}</tbody></table>\${confirmed || previewItems.length === 0 ? "" : html\`<div class="surface-actions"><button type="button" onclick=\${confirmPriceIncrease}>Confirm and update \${previewItems.length} prices</button></div>\`}</section>\`;
};`,
    };
  }

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

  var copied = await Promise.all(selected.map(function (itemId) {
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
  })}</div><div class="surface-actions"><button type="button" onclick=\${duplicateSelected}>Duplicate selected</button><a class="surface-action" href="/menus">Open menus</a></div>\${duplicatedItems.length === 0 ? "" : html\`<div class="surface-list">\${duplicatedItems.map(function (item) {
    return html\`<div class="surface-item"><span><strong>\${item.name}</strong><span>Created by generated UI action</span></span></div>\`;
  })}</div>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("sam rivera") || normalized.includes("user")) {
    return {
      summary: "Preview and confirm Sam Rivera as a manager.",
      input: { name: "Sam Rivera", role: "manager" },
      code: `
var createdUser = null;
var status = "Review the staff record before creating it.";
async function confirmCreateUser() {
  var created = await tools.users.create({ name: input.name, role: input.role });
  createdUser = created.user;
  status = createdUser.name + " is available as " + createdUser.role + ".";
}
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Create staff member</h2><p class="surface-text">\${input.name} · \${input.role}</p><p class="surface-muted">\${status}</p>\${createdUser ? html\`<div class="surface-actions"><a class="surface-action" href="/users">Open staff</a></div>\` : html\`<div class="surface-actions"><button type="button" onclick=\${confirmCreateUser}>Confirm staff member</button></div>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("vegetarian")) {
    return {
      summary: "Preview and confirm a Vegetarian Specials menu.",
      input: { targetMenuName: "Vegetarian Specials" },
      code: `
var menusResult = await tools.menus.list({});
var vegetarianItems = [];
for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  var menu = menusResult.menus[menuIndex];
  if (menu.name !== input.targetMenuName) {
    var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
    for (var itemIndex = 0; itemIndex < itemsResult.items.length; itemIndex = itemIndex + 1) {
      var item = itemsResult.items[itemIndex];
      if (item.tags.indexOf("vegetarian") !== -1) {
        vegetarianItems.push({ sourceMenu: menu.name, item: item });
      }
    }
  }
}
var createdItems = [];
var targetMenu = null;
var confirmed = false;
var status = "Review the matching items before creating the menu.";
async function confirmCreateMenu() {
  status = "Creating the confirmed menu...";
  var menuResult = await tools.menus.create({
    name: input.targetMenuName,
    description: "Vegetarian favorites collected from existing menus."
  });
  targetMenu = menuResult.menu;
  for (var index = 0; index < vegetarianItems.length; index = index + 1) {
    var source = vegetarianItems[index].item;
    var created = await tools.menu.item.create({
      menuId: targetMenu.menuId,
      name: source.name,
      price: source.price,
      tags: source.tags
    });
    createdItems.push(created.item);
  }
  confirmed = true;
  status = targetMenu.name + " is ready with " + createdItems.length + " items.";
}
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Create Vegetarian Specials</h2><p class="surface-muted">\${status}</p><div class="surface-list">\${vegetarianItems.map(function (entry) {
    return html\`<article class="surface-item"><span><strong>\${entry.item.name}</strong><span>From \${entry.sourceMenu} · \${"$" + entry.item.price.toFixed(2)}</span></span></article>\`;
  })}</div>\${confirmed || vegetarianItems.length === 0 ? "" : html\`<div class="surface-actions"><button type="button" onclick=\${confirmCreateMenu}>Confirm and create menu</button></div>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("seasonal") && normalized.includes("tag")) {
    return {
      summary: "Preview and confirm seasonal tags for drinks under $7.",
      input: { menuName: "Drinks Menu", maximumPrice: 7, tag: "seasonal" },
      code: `
var menusResult = await tools.menus.list({});
var drinksMenu = null;
for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  if (menusResult.menus[menuIndex].name === input.menuName) {
    drinksMenu = menusResult.menus[menuIndex];
  }
}
var previewItems = [];
if (drinksMenu) {
  var itemsResult = await tools.menu.items.list({ menuId: drinksMenu.menuId });
  previewItems = itemsResult.items.filter(function (item) {
    return item.price < input.maximumPrice;
  }).map(function (item) {
    var nextTags = item.tags.indexOf(input.tag) === -1 ? item.tags.concat([input.tag]) : item.tags;
    return { item: item, beforeTags: item.tags, afterTags: nextTags, updated: null };
  });
}
var confirmed = false;
var status = drinksMenu ? "Review the tag changes before applying them." : "Drinks Menu was not found.";
async function confirmTags() {
  status = "Applying confirmed tags...";
  var updated = await Promise.all(previewItems.map(function (entry) {
    return tools.menu.item.update({
      menuId: entry.item.menuId,
      itemId: entry.item.itemId,
      tags: entry.afterTags
    });
  }));
  previewItems = previewItems.map(function (entry, index) {
    return { item: entry.item, beforeTags: entry.beforeTags, afterTags: entry.afterTags, updated: updated[index].item };
  });
  confirmed = true;
  status = updated.length + " confirmed tag " + (updated.length === 1 ? "change" : "changes") + " applied.";
}
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Seasonal drink tags</h2><p class="surface-muted">\${status}</p><div class="surface-list">\${previewItems.map(function (entry) {
    return html\`<article class="surface-item"><span><strong>\${entry.item.name}</strong><span>Before: \${entry.beforeTags.join(", ") || "no tags"} · After: \${entry.afterTags.join(", ")}</span></span></article>\`;
  })}</div>\${confirmed || previewItems.length === 0 ? "" : html\`<div class="surface-actions"><button type="button" onclick=\${confirmTags}>Confirm and update tags</button></div>\`}</section>\`;
};`,
    };
  }

  if (
    normalized.includes("copy") &&
    normalized.includes("dinner") &&
    normalized.includes("brunch")
  ) {
    return {
      summary: "Preview and confirm popular Dinner items for Brunch.",
      input: { sourceMenuName: "Dinner Menu", targetMenuName: "Brunch Menu" },
      code: `
var menusResult = await tools.menus.list({});
var sourceMenu = null;
var targetMenu = null;
for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  var menu = menusResult.menus[menuIndex];
  if (menu.name === input.sourceMenuName) sourceMenu = menu;
  if (menu.name === input.targetMenuName) targetMenu = menu;
}
var popularItems = [];
if (sourceMenu) {
  var itemsResult = await tools.menu.items.list({ menuId: sourceMenu.menuId });
  popularItems = itemsResult.items.filter(function (item) {
    return item.tags.indexOf("popular") !== -1;
  });
}
var copiedItems = [];
var confirmed = false;
var status = sourceMenu && targetMenu ? "Review the items before copying them." : "The source or target menu was not found.";
async function confirmCopy() {
  status = "Copying confirmed items...";
  for (var index = 0; index < popularItems.length; index = index + 1) {
    var item = popularItems[index];
    var copied = await tools.menu.item.create({
      menuId: targetMenu.menuId,
      name: item.name,
      price: item.price,
      tags: item.tags
    });
    copiedItems.push(copied.item);
  }
  confirmed = true;
  status = copiedItems.length + " popular " + (copiedItems.length === 1 ? "item" : "items") + " copied into " + targetMenu.name + ".";
}
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Copy popular Dinner items</h2><p class="surface-muted">\${status}</p><div class="surface-list">\${popularItems.map(function (item) {
    return html\`<article class="surface-item"><span><strong>\${item.name}</strong><span>\${"$" + item.price.toFixed(2) + " · " + item.tags.join(", ")}</span></span></article>\`;
  })}</div>\${confirmed || popularItems.length === 0 || !targetMenu ? "" : html\`<div class="surface-actions"><button type="button" onclick=\${confirmCopy}>Confirm copy to Brunch</button></div>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("summarize") || normalized.includes("summary")) {
    return {
      summary: "Summarize the current restaurant data.",
      input: {},
      code: `
var menusResult = await tools.menus.list({});
var usersResult = await tools.users.list({});
var itemCount = 0;
for (var index = 0; index < menusResult.menus.length; index = index + 1) {
  var menu = menusResult.menus[index];
  var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
  itemCount = itemCount + itemsResult.items.length;
}
return html\`<section class="surface-card"><p class="surface-text">Restaurant summary: \${menusResult.menus.length} menus, \${itemCount} items, \${usersResult.users.length} users.</p><div class="surface-actions"><a class="surface-action" href="/menus">Open menus</a><a class="surface-action" href="/users">Open users</a></div></section>\`;`,
    };
  }

  return {
    summary: "Show the current restaurant data available in mock mode.",
    input: { task },
    code: `
var menusResult = await tools.menus.list({});
var usersResult = await tools.users.list({});
return html\`<section class="surface-card"><h2 class="surface-title">Mock planner</h2><p class="surface-text">This custom request is not one of the deterministic local showcase tasks.</p><p class="surface-muted">Current data: \${menusResult.menus.length} menus and \${usersResult.users.length} staff members.</p><div class="surface-actions"><a class="surface-action" href="/menus">Open menus</a><a class="surface-action" href="/users">Open staff</a></div></section>\`;`,
  };
}
