<script lang="ts">
  import { page } from "$app/state";
  import LoadingSurface from "$lib/components/photoship/LoadingSurface.svelte";
  import { BookOpen, CheckCircle2, Search, Trash2 } from "@lucide/svelte";
  import {
    deleteMenuItemCommand,
    getMenusWithItems,
  } from "$lib/remote/example.remote";

  const menusResponse = $derived(getMenusWithItems().current);
  const menus = $derived(menusResponse?.menus ?? []);

  let selectedMenuId = $state<string | undefined>();
  let search = $state("");
  let deletingItemId = $state("");
  let deleteError = $state("");
  const requestedMenuId = $derived(
    page.url.searchParams.get("menu") ?? undefined,
  );
  const changedItemIds = $derived(
    new Set(
      (page.url.searchParams.get("changed") ?? "").split(",").filter(Boolean),
    ),
  );
  const selectedMenu = $derived(
    menus.find((menu) => menu.menuId === (selectedMenuId ?? requestedMenuId)) ??
      menus[0],
  );
  const visibleItems = $derived(
    selectedMenu?.items.filter((item) => {
      const query = search.trim().toLowerCase();
      return (
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }) ?? [],
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
  <header
    class="flex flex-col justify-between gap-3 py-1 sm:flex-row sm:items-center"
  >
    <div class="flex items-center gap-3">
      <BookOpen class="shrink-0 text-primary-600" size={23} strokeWidth={2.2} />
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-slate-950">
          Menus and pricing
        </h1>
        <p class="mt-0.5 text-xs text-neutral-500">
          {menus.length} menus · {menus.reduce(
            (total, menu) => total + menu.items.length,
            0,
          )} items
        </p>
      </div>
    </div>
    <label class="relative block w-full sm:w-72">
      <span class="sr-only">Search the selected menu</span>
      <Search
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        size={16}
        strokeWidth={2}
      />
      <input
        bind:value={search}
        class="h-10 w-full border border-neutral-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        placeholder="Search items or tags"
      />
    </label>
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
          <span class="mt-0.5 block text-[10px] opacity-75">
            {#if menu.items.some((item) => changedItemIds.has(item.itemId))}
              {menu.items.filter((item) => changedItemIds.has(item.itemId))
                .length}
              updated
            {:else}
              {menu.items.length} item{menu.items.length === 1 ? "" : "s"}
            {/if}
          </span>
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

        {#each visibleItems as item}
          <article
            class={`flex items-center justify-between gap-4 py-4 ${
              changedItemIds.has(item.itemId)
                ? "-mx-3 border-l-4 border-l-emerald-600 bg-emerald-50 px-3"
                : ""
            }`}
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-base font-medium text-neutral-950">
                  {item.name}
                </h3>
                {#if changedItemIds.has(item.itemId)}
                  <span
                    class="inline-flex items-center gap-1 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"
                  >
                    <CheckCircle2 size={11} strokeWidth={2.4} />
                    Updated by task
                  </span>
                {/if}
              </div>
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
            <h3 class="text-base font-medium text-neutral-950">
              {search ? "No matching items" : "No items yet"}
            </h3>
            <p class="mt-1 text-neutral-600">
              {search
                ? "Try another item name or tag."
                : "Use the overview to create or move items into this menu."}
            </p>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</section>
