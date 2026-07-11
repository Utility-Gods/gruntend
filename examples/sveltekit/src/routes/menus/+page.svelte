<script lang="ts">
  import LoadingSurface from "$lib/components/photoship/LoadingSurface.svelte";
  import { BookOpen, Trash2 } from "lucide-svelte";
  import {
    deleteMenuItemCommand,
    getMenusWithItems,
  } from "$lib/remote/example.remote";

  const menusResponse = $derived(getMenusWithItems().current);
  const menus = $derived(menusResponse?.menus ?? []);

  let selectedMenuId = $state<string | undefined>();
  let deletingItemId = $state("");
  let deleteError = $state("");
  const selectedMenu = $derived(
    selectedMenuId
      ? (menus.find((menu) => menu.menuId === selectedMenuId) ?? menus[0])
      : menus[0],
  );

  async function deleteItem(menuId: string, itemId: string) {
    if (deletingItemId) return;

    deletingItemId = itemId;
    deleteError = "";

    try {
      await deleteMenuItemCommand({ menuId, itemId }).updates(
        getMenusWithItems(),
      );
    } catch (caught) {
      deleteError =
        caught instanceof Error
          ? caught.message
          : "Unable to delete menu item.";
    } finally {
      deletingItemId = "";
    }
  }
</script>

<section class="space-y-5">
  <header class="flex items-center gap-3 py-1">
    <BookOpen class="shrink-0 text-primary-600" size={23} strokeWidth={2.2} />
    <h1 class="text-xl font-semibold tracking-tight text-slate-950">Menus and pricing</h1>
  </header>

  {#if !menusResponse}
    <LoadingSurface label="Loading menus from the demo database..." rows={5} />
  {:else if selectedMenu}
    <div
      class="flex overflow-x-auto border border-neutral-200 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Menus"
    >
      {#each menus as menu}
        <button
          type="button"
          role="tab"
          aria-selected={menu.menuId === selectedMenu.menuId}
          class={`shrink-0 px-4 py-2 text-left text-sm font-semibold transition ${
            menu.menuId === selectedMenu.menuId
              ? "bg-primary-600 text-white"
              : "text-neutral-600 hover:bg-primary-600 hover:text-white"
          }`}
          onclick={() => (selectedMenuId = menu.menuId)}
        >
          <span class="block">{menu.name}</span>
        </button>
      {/each}
    </div>

    <section class="border border-neutral-200 bg-white p-6 shadow-sm">
      <div class="space-y-2 border-b border-neutral-100 pb-5">
        <h2 class="text-xl font-semibold tracking-tight text-neutral-950">
          {selectedMenu.name}
        </h2>
        <p class="text-base text-neutral-600">{selectedMenu.description}</p>
      </div>

      <div class="divide-y divide-neutral-100">
        {#if deleteError}
          <p class="py-3 text-sm font-medium text-red-700">{deleteError}</p>
        {/if}

        {#each selectedMenu.items as item}
          <article class="flex items-center justify-between gap-4 py-4">
            <div class="min-w-0">
              <h3 class="truncate text-base font-medium text-neutral-950">
                {item.name}
              </h3>
              <p class="truncate text-sm text-neutral-500">
                {item.tags.join(" · ") || "No tags"}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <strong class="text-sm font-semibold text-primary-700"
                >${item.price.toFixed(2)}</strong
              >
              <button
                type="button"
                class="inline-flex items-center gap-1.5 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:border-red-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingItemId === item.itemId}
                onclick={() => deleteItem(selectedMenu.menuId, item.itemId)}
              >
                <Trash2 size={13} strokeWidth={2} />
                {deletingItemId === item.itemId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        {:else}
          <div class="py-8">
            <h3 class="text-base font-medium text-neutral-950">No items yet</h3>
            <p class="mt-1 text-neutral-600">Use the overview to create or move items into this menu.</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</section>
