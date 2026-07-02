export interface MenuRequestData {
  readonly menuName: string;
  readonly items: readonly MenuItemData[];
}

export interface MenuItemData {
  readonly name: string;
  readonly price: number;
}

export async function generateMenuCodePlan(data: MenuRequestData): Promise<string> {
  const itemJson = JSON.stringify(data.items, null, 2);
  const menuNameJson = JSON.stringify(data.menuName);

  return `
const menu = await tools.menu.create({
  name: ${menuNameJson},
});

const items = ${itemJson};

const createdItems = await parallel(
  items.map((item) =>
    tools.menu.item.create({
      menuId: menu.menuId,
      name: item.name,
      price: item.price,
    })
  )
);

return {
  menu,
  items: createdItems,
};
`;
}
