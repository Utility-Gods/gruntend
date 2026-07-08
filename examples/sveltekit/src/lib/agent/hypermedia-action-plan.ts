import type { GeneratedCodePlan } from "gruntend/generate";
import { matchSemanticActionPath } from "gruntend/hypermedia";

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

export function createHypermediaActionPlan(href: string): GeneratedCodePlan | undefined {
  const itemAction = matchSemanticActionPath(href, "/menus/{menuId}/items/{itemId}/actions/{action}");
  if (!itemAction.isOk()) return undefined;

  const { menuId, itemId, action } = itemAction.value.params;

  if (typeof menuId !== "string" || typeof itemId !== "string" || typeof action !== "string") {
    return undefined;
  }

  if (action === "view") {
    return {
      summary: "View a menu item through a hypermedia action code plan.",
      input: { menuId, itemId },
      code: `${htmlHelpers}
var itemsResult = await tools.menu.items.list({ menuId: input.menuId });
var selected = null;
for (var index = 0; index < itemsResult.items.length; index = index + 1) {
  if (itemsResult.items[index].itemId === input.itemId) {
    selected = itemsResult.items[index];
  }
}
if (!selected) {
  return { action: "view-menu-item", html: renderTextSurface("The selected menu item no longer exists.") };
}
return {
  action: "view-menu-item",
  item: selected,
  html: renderMenuItemsSurface("Selected menu item.", [selected])
};`,
    };
  }

  if (action === "duplicate") {
    return {
      summary: "Duplicate a menu item through a hypermedia action code plan.",
      input: { menuId, itemId },
      code: `${htmlHelpers}
var duplicated = await tools.menu.item.duplicate({ menuId: input.menuId, itemId: input.itemId });
return {
  action: "duplicated-menu-item",
  item: duplicated.item,
  html: renderMenuItemsSurface("Duplicated menu item.", [duplicated.item])
};`,
    };
  }

  if (action === "delete") {
    return {
      summary: "Delete a menu item through a hypermedia action code plan.",
      input: { menuId, itemId },
      code: `${htmlHelpers}
var deleted = await tools.menu.item.delete({ menuId: input.menuId, itemId: input.itemId });
return {
  action: "deleted-menu-item",
  item: deleted.item,
  html: renderTextSurface("Deleted " + deleted.item.name + ".")
};`,
    };
  }

  return undefined;
}
