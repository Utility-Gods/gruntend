import type { GeneratedCodePlan } from "gruntend-sdk/generate";

export function createMockPlan(task: string): GeneratedCodePlan {
  const normalized = task.toLowerCase();

  if (normalized.includes("paid revenue") && normalized.includes("day")) {
    return {
      summary: "Show paid revenue by day from persisted orders and payments.",
      input: {},
      code: `
var ordersResult = await tools.orders.list({});
var days = [];
ordersResult.orders.filter(function (order) { return order.payment && order.payment.status === "paid"; }).forEach(function (order) {
  var day = order.payment.paidAt.slice(5, 10);
  var existing = days.find(function (entry) { return entry.day === day; });
  if (existing) existing.revenue = existing.revenue + order.payment.amount;
  else days.push({ day: day, revenue: order.payment.amount });
});
days.sort(function (left, right) { return left.day.localeCompare(right.day); });
var maximum = Math.max.apply(null, days.map(function (entry) { return entry.revenue; })) || 1;
return html\`<section class="surface-card"><h2 class="surface-title">Paid revenue by day</h2><p class="surface-muted">Calculated from settled D1 payment records.</p><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Served revenue by day">\${days.map(function (entry, index) {
  var barWidth = 58; var gap = 28; var x = 42 + index * (barWidth + gap); var height = entry.revenue / maximum * 180;
  return html\`<g><rect x=\${x} y=\${225 - height} width=\${barWidth} height=\${height} fill="#f54a00"></rect><text x=\${x + barWidth / 2} y="250" text-anchor="middle">\${entry.day}</text><text x=\${x + barWidth / 2} y=\${215 - height} text-anchor="middle">\${"$" + entry.revenue.toFixed(0)}</text></g>\`;
})}</svg></section>\`;`,
    };
  }

  if (normalized.includes("best-selling") || normalized.includes("popular dishes")) {
    return {
      summary: "Explore best-selling dishes from order-line quantities.",
      input: {},
      code: `
var ordersResult = await tools.orders.list({});
var items = [];
ordersResult.orders.filter(function (order) { return order.payment && order.payment.status === "paid"; }).forEach(function (order) {
  order.lines.forEach(function (line) {
    var existing = items.find(function (entry) { return entry.itemId === line.itemId; });
    if (!existing) { existing = { itemId: line.itemId, name: line.itemName, quantity: 0, revenue: 0 }; items.push(existing); }
    existing.quantity = existing.quantity + line.quantity;
    existing.revenue = existing.revenue + line.unitPrice * line.quantity;
  });
});
items.sort(function (a, b) { return b.quantity - a.quantity; });
items = items.slice(0, 7);
var maximum = items.length ? items[0].quantity : 1;
var selected = null;
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Best-selling dishes</h2><p class="surface-muted">Select a bar to inspect quantity and revenue.</p><svg class="surface-chart" viewBox="0 0 720 310" role="img" aria-label="Best-selling dishes">\${items.map(function (item, index) {
    var barWidth = 58; var gap = 33; var x = 35 + index * (barWidth + gap); var height = item.quantity / maximum * 190;
    return html\`<g onclick=\${function () { selected = item; }}><rect x=\${x} y=\${230 - height} width=\${barWidth} height=\${height} fill=\${selected && selected.itemId === item.itemId ? "#0f172a" : "#f54a00"}></rect><text x=\${x + barWidth / 2} y="252" text-anchor="middle">\${item.name}</text><text x=\${x + barWidth / 2} y=\${220 - height} text-anchor="middle">\${item.quantity}</text></g>\`;
  })}</svg>\${selected ? html\`<div class="surface-item"><span><strong>\${selected.name}</strong><span>\${selected.quantity + " sold · $" + selected.revenue.toFixed(2) + " revenue"}</span></span></div>\` : html\`<p class="surface-text">No dish selected.</p>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("order status")) {
    return {
      summary: "Show the current order status mix as an accessible chart.",
      input: {},
      code: `
var ordersResult = await tools.orders.list({});
var names = ["open", "preparing", "served", "cancelled"];
var statuses = names.map(function (name) { return { name: name, count: ordersResult.orders.filter(function (order) { return order.status === name; }).length }; });
var maximum = Math.max.apply(null, statuses.map(function (entry) { return entry.count; })) || 1;
return html\`<section class="surface-card"><h2 class="surface-title">Order status mix</h2><p class="surface-muted">Live counts from persisted orders.</p><svg class="surface-chart" viewBox="0 0 640 280" role="img" aria-label="Order status counts">\${statuses.map(function (entry, index) { var x = 50 + index * 145; var height = entry.count / maximum * 165; return html\`<g><rect x=\${x} y=\${220 - height} width="92" height=\${height} fill=\${entry.name === "cancelled" ? "#dc2626" : "#f54a00"}></rect><text x=\${x + 46} y="245" text-anchor="middle">\${entry.name}</text><text x=\${x + 46} y=\${210 - height} text-anchor="middle">\${entry.count}</text></g>\`; })}</svg></section>\`;`,
    };
  }

  if (normalized.includes("average paid order") || normalized.includes("average ticket")) {
    return {
      summary: "Track average paid order value by day.",
      input: {},
      code: `
var ordersResult = await tools.orders.list({});
var groups = [];
ordersResult.orders.filter(function (order) { return order.payment && order.payment.status === "paid"; }).forEach(function (order) { var day = order.payment.paidAt.slice(5, 10); var group = groups.find(function (entry) { return entry.day === day; }); if (!group) { group = { day: day, values: [] }; groups.push(group); } group.values.push(order.payment.amount); });
groups.sort(function (left, right) { return left.day.localeCompare(right.day); });
var averages = groups.map(function (group) { return { day: group.day, average: group.values.reduce(function (sum, value) { return sum + value; }, 0) / group.values.length }; });
var maximum = Math.max.apply(null, averages.map(function (entry) { return entry.average; })) || 1;
var points = averages.map(function (entry, index) { return { x: 55 + index * 92, y: 225 - entry.average / maximum * 165, entry: entry }; });
return html\`<section class="surface-card"><h2 class="surface-title">Average paid ticket</h2><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Average served order value by day"><polyline points=\${points.map(function (point) { return point.x + "," + point.y; }).join(" ")} fill="none" stroke="#f54a00" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>\${points.map(function (point) { return html\`<g><circle cx=\${point.x} cy=\${point.y} r="6" fill="#0f172a"></circle><text x=\${point.x} y="252" text-anchor="middle">\${point.entry.day}</text><text x=\${point.x} y=\${point.y - 13} text-anchor="middle">\${"$" + point.entry.average.toFixed(0)}</text></g>\`; })}</svg></section>\`;`,
    };
  }

  if (normalized.includes("paid sales") && normalized.includes("assigned")) {
    return {
      summary: "Compare paid sales, tips, and completed orders by assigned floor staff.",
      input: {},
      code: `
var usersResult = await tools.users.list({});
var ordersResult = await tools.orders.list({});
var staff = usersResult.users.filter(function (user) { return user.role === "manager" || user.role === "server"; }).map(function (user) {
  var assigned = ordersResult.orders.filter(function (order) { return order.assignedUserId === user.userId && order.payment && order.payment.status === "paid"; });
  return {
    name: user.name,
    role: user.role,
    orders: assigned.length,
    sales: assigned.reduce(function (total, order) { return total + order.payment.amount; }, 0),
    tips: assigned.reduce(function (total, order) { return total + order.payment.tip; }, 0)
  };
});
var maximum = Math.max.apply(null, staff.map(function (entry) { return entry.sales; })) || 1;
var selected = null;
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Floor performance</h2><p class="surface-muted">Paid sales are attributed through each order's assigned staff relationship.</p><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Paid sales by assigned floor staff">\${staff.map(function (entry, index) { var x = 90 + index * 180; var height = entry.sales / maximum * 175; return html\`<g onclick=\${function () { selected = entry; }}><rect x=\${x} y=\${225 - height} width="92" height=\${height} fill=\${selected && selected.name === entry.name ? "#0f172a" : "#f54a00"}></rect><text x=\${x + 46} y="250" text-anchor="middle">\${entry.name}</text><text x=\${x + 46} y=\${215 - height} text-anchor="middle">\${"$" + entry.sales.toFixed(0)}</text></g>\`; })}</svg>\${selected ? html\`<div class="surface-item"><span><strong>\${selected.name}</strong><span>\${selected.role + " · " + selected.orders + " paid orders · $" + selected.tips.toFixed(2) + " tips"}</span></span></div>\` : html\`<p class="surface-text">Select a staff member for details.</p>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("reservation outcomes")) {
    return {
      summary: "Show reservation outcomes and linked-order conversion.",
      input: {},
      code: `
var reservationsResult = await tools.reservations.list({});
var names = ["booked", "seated", "completed", "cancelled", "no-show"];
var outcomes = names.map(function (name) { var rows = reservationsResult.reservations.filter(function (reservation) { return reservation.status === name; }); return { name: name, count: rows.length, converted: rows.filter(function (reservation) { return !!reservation.orderId; }).length }; });
var maximum = Math.max.apply(null, outcomes.map(function (entry) { return entry.count; })) || 1;
return html\`<section class="surface-card"><h2 class="surface-title">Reservation outcomes</h2><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Reservation outcomes and order conversion">\${outcomes.map(function (entry, index) { var x = 45 + index * 130; var height = entry.count / maximum * 175; return html\`<g><rect x=\${x} y=\${225 - height} width="78" height=\${height} fill="#f54a00"></rect><text x=\${x + 39} y="250" text-anchor="middle">\${entry.name}</text><text x=\${x + 39} y=\${215 - height} text-anchor="middle">\${entry.count}</text></g>\`; })}</svg><p class="surface-text">\${reservationsResult.reservations.filter(function (reservation) { return !!reservation.orderId; }).length + " of " + reservationsResult.reservations.length + " reservations are linked to orders."}</p></section>\`;`,
    };
  }

  if (normalized.includes("payment method") && normalized.includes("grouped")) {
    return {
      summary: "Compare settled revenue and tips by payment method.",
      input: {},
      code: `
var paymentsResult = await tools.payments.list({});
var methods = ["card", "cash", "gift-card"].map(function (method) {
  var paid = paymentsResult.payments.filter(function (payment) { return payment.status === "paid" && payment.method === method; });
  return {
    method: method,
    revenue: paid.reduce(function (total, payment) { return total + payment.amount; }, 0),
    tips: paid.reduce(function (total, payment) { return total + payment.tip; }, 0),
    count: paid.length
  };
});
var maximum = Math.max.apply(null, methods.map(function (entry) { return entry.revenue; })) || 1;
return html\`<section class="surface-card"><h2 class="surface-title">Paid revenue and tips by payment method</h2><p class="surface-muted">Orange shows settled order revenue. Navy shows tips.</p><svg class="surface-chart" viewBox="0 0 720 320" role="img" aria-label="Paid revenue and tips by payment method">\${methods.map(function (entry, index) {
  var x = 95 + index * 205;
  var revenueHeight = entry.revenue / maximum * 185;
  var tipHeight = entry.tips / maximum * 185;
  return html\`<g><rect x=\${x} y=\${235 - revenueHeight} width="64" height=\${revenueHeight} fill="#f54a00"></rect><rect x=\${x + 70} y=\${235 - tipHeight} width="64" height=\${tipHeight} fill="#0f172a"></rect><text x=\${x + 67} y="262" text-anchor="middle">\${entry.method}</text><text x=\${x + 32} y=\${225 - revenueHeight} text-anchor="middle">\${"$" + entry.revenue.toFixed(0)}</text><text x=\${x + 102} y=\${225 - tipHeight} text-anchor="middle">\${"$" + entry.tips.toFixed(0)}</text></g>\`;
})}</svg><p class="surface-text">\${methods.map(function (entry) { return entry.method + ": " + entry.count + " paid payments"; }).join(" · ")}</p></section>\`;`,
    };
  }

  if (normalized.includes("loyalty tier") && normalized.includes("interactive")) {
    return {
      summary: "Explore paid revenue and ticket details by customer loyalty tier.",
      input: {},
      code: `
var ordersResult = await tools.orders.list({});
var tiers = ["standard", "silver", "gold"].map(function (tier) {
  var paid = ordersResult.orders.filter(function (order) { return order.customer.loyaltyTier === tier && order.payment && order.payment.status === "paid"; });
  var revenue = paid.reduce(function (total, order) { return total + order.payment.amount; }, 0);
  return { tier: tier, revenue: revenue, count: paid.length, average: paid.length ? revenue / paid.length : 0 };
});
var maximum = Math.max.apply(null, tiers.map(function (entry) { return entry.revenue; })) || 1;
var selected = null;
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Paid revenue by loyalty tier</h2><p class="surface-muted">Select a tier to inspect paid order count and average ticket.</p><svg class="surface-chart" viewBox="0 0 720 310" role="img" aria-label="Paid revenue by customer loyalty tier">\${tiers.map(function (entry, index) {
    var x = 105 + index * 205; var height = entry.revenue / maximum * 185;
    return html\`<g onclick=\${function () { selected = entry; }}><rect x=\${x} y=\${230 - height} width="105" height=\${height} fill=\${selected && selected.tier === entry.tier ? "#0f172a" : "#f54a00"}></rect><text x=\${x + 52} y="258" text-anchor="middle">\${entry.tier}</text><text x=\${x + 52} y=\${220 - height} text-anchor="middle">\${"$" + entry.revenue.toFixed(0)}</text></g>\`;
  })}</svg>\${selected ? html\`<div class="surface-item"><span><strong>\${selected.tier + " loyalty"}</strong><span>\${selected.count + " paid orders · $" + selected.average.toFixed(2) + " average ticket"}</span></span></div>\` : html\`<p class="surface-text">Select a loyalty tier.</p>\`}</section>\`;
};`,
    };
  }

  if (normalized.includes("price distribution")) {
    return {
      summary: "Show item price distribution as an accessible chart.",
      input: {},
      code: `
var menusResult = await tools.menus.list({});
var allItems = [];
for (var menuIndex = 0; menuIndex < menusResult.menus.length; menuIndex = menuIndex + 1) {
  var itemsResult = await tools.menu.items.list({ menuId: menusResult.menus[menuIndex].menuId });
  allItems = allItems.concat(itemsResult.items);
}
var ranges = [
  { name: "Under $10", count: allItems.filter(function (item) { return item.price < 10; }).length },
  { name: "$10 to $20", count: allItems.filter(function (item) { return item.price >= 10 && item.price <= 20; }).length },
  { name: "Over $20", count: allItems.filter(function (item) { return item.price > 20; }).length }
];
var maximum = Math.max.apply(null, ranges.map(function (entry) { return entry.count; })) || 1;
return html\`<section class="surface-card"><h2 class="surface-title">Item price distribution</h2><p class="surface-muted">Current items grouped into operational price ranges.</p><svg class="surface-chart" viewBox="0 0 640 280" role="img" aria-label="Restaurant item price distribution">\${ranges.map(function (entry, index) { var barWidth = 110; var gap = 65; var x = 75 + index * (barWidth + gap); var height = entry.count / maximum * 160; return html\`<g><rect x=\${x} y=\${220 - height} width=\${barWidth} height=\${height} fill="#f54a00"></rect><text x=\${x + barWidth / 2} y="245" text-anchor="middle">\${entry.name}</text><text x=\${x + barWidth / 2} y=\${210 - height} text-anchor="middle">\${entry.count}</text></g>\`; })}</svg><p class="surface-text">\${ranges.map(function (entry) { return entry.name + ": " + entry.count; }).join(" · ")}</p></section>\`;
`,
    };
  }

  if (normalized.includes("interactive") && normalized.includes("dinner")) {
    return {
      summary: "Render an interactive SVG chart of Dinner item prices.",
      input: { menuName: "Dinner Menu" },
      code: `
var menusResult = await tools.menus.list({});
var menu = menusResult.menus.find(function (entry) { return entry.name === input.menuName; });
if (!menu) return html\`<section class="surface-card"><p class="surface-text">Dinner Menu was not found.</p></section>\`;
var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
var items = itemsResult.items;
var maximum = Math.max.apply(null, items.map(function (item) { return item.price; })) || 1;
var selected = null;
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Dinner item prices</h2><p class="surface-muted">Select a bar to inspect its item.</p><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Interactive Dinner item price chart">\${items.map(function (item, index) {
    var barWidth = 52;
    var gap = 30;
    var x = 48 + index * (barWidth + gap);
    var height = item.price / maximum * 190;
    return html\`<g onclick=\${function () { selected = item; }}><rect x=\${x} y=\${230 - height} width=\${barWidth} height=\${height} fill=\${selected && selected.itemId === item.itemId ? "#0f172a" : "#f54a00"}></rect><text x=\${x + barWidth / 2} y="252" text-anchor="middle">\${item.name}</text><text x=\${x + barWidth / 2} y=\${220 - height} text-anchor="middle">\${"$" + item.price.toFixed(2)}</text></g>\`;
  })}</svg>\${selected ? html\`<div class="surface-item"><span><strong>\${selected.name}</strong><span>\${"$" + selected.price.toFixed(2) + " · " + (selected.tags.join(", ") || "no tags")}</span></span></div>\` : html\`<p class="surface-text">No item selected.</p>\`}</section>\`;
};
`,
    };
  }

  if (normalized.includes("average item price") && normalized.includes("line chart")) {
    return {
      summary: "Compare average menu prices with a native SVG line chart.",
      input: {},
      code: `
var menusResult = await tools.menus.list({});
var averages = await Promise.all(menusResult.menus.map(async function (menu) {
  var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
  var total = itemsResult.items.reduce(function (sum, item) { return sum + item.price; }, 0);
  return { name: menu.name, average: itemsResult.items.length ? total / itemsResult.items.length : 0 };
}));
var maximum = Math.max.apply(null, averages.map(function (entry) { return entry.average; })) || 1;
var points = averages.map(function (entry, index) {
  return { x: 70 + index * 130, y: 220 - entry.average / maximum * 160, entry: entry };
});
return html\`<section class="surface-card"><h2 class="surface-title">Average item price by menu</h2><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Average item price by menu"><polyline points=\${points.map(function (point) { return point.x + "," + point.y; }).join(" ")} fill="none" stroke="#f54a00" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>\${points.map(function (point) {
  return html\`<g><circle cx=\${point.x} cy=\${point.y} r="7" fill="#0f172a"></circle><text x=\${point.x} y="250" text-anchor="middle">\${point.entry.name}</text><text x=\${point.x} y=\${point.y - 14} text-anchor="middle">\${"$" + point.entry.average.toFixed(2)}</text></g>\`;
})}</svg><p class="surface-muted">Average prices calculated from current menu records.</p></section>\`;
`,
    };
  }

  if (normalized.includes("bar chart") && normalized.includes("each menu")) {
    return {
      summary: "Render menu item counts as a native SVG bar chart.",
      input: {},
      code: `
var menusResult = await tools.menus.list({});
var menuCounts = await Promise.all(menusResult.menus.map(async function (menu) {
  var itemsResult = await tools.menu.items.list({ menuId: menu.menuId });
  return { name: menu.name, count: itemsResult.items.length };
}));
var maximum = Math.max.apply(null, menuCounts.map(function (entry) { return entry.count; })) || 1;
return html\`<section class="surface-card"><h2 class="surface-title">Items by menu</h2><svg class="surface-chart" viewBox="0 0 720 300" role="img" aria-label="Item count by menu">\${menuCounts.map(function (entry, index) {
  var barWidth = 72;
  var gap = 45;
  var x = 52 + index * (barWidth + gap);
  var height = entry.count / maximum * 190;
  return html\`<g><rect x=\${x} y=\${230 - height} width=\${barWidth} height=\${height} fill="#f54a00"></rect><text x=\${x + barWidth / 2} y="252" text-anchor="middle">\${entry.name}</text><text x=\${x + barWidth / 2} y=\${220 - height} text-anchor="middle">\${entry.count}</text></g>\`;
})}</svg><p class="surface-muted">Native SVG returned directly by the JavaScript plan.</p></section>\`;
`,
    };
  }

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
