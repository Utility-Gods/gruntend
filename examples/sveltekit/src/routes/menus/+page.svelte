<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let selectedMenuId = $state(data.menus[0]?.menuId ?? "");
  const selectedMenu = $derived(data.menus.find((menu) => menu.menuId === selectedMenuId) ?? data.menus[0]);
</script>

<section class="mx-auto max-w-5xl space-y-6">
  <header class="space-y-2">
    <p class="text-xs font-medium uppercase tracking-[0.12em] text-orange-600">Menus</p>
    <h1 class="text-3xl font-medium tracking-tight text-neutral-950">Restaurant menus</h1>
    <p class="max-w-2xl text-base leading-7 text-neutral-600">
      Switch between menus to review the live items created by the app and the agent.
    </p>
  </header>

  {#if selectedMenu}
    <nav class="flex gap-7 overflow-x-auto border-b border-neutral-200" role="tablist" aria-label="Menus">
      {#each data.menus as menu}
        <button
          type="button"
          role="tab"
          aria-selected={menu.menuId === selectedMenu.menuId}
          class={`shrink-0 border-b-2 pb-3 text-left transition ${
            menu.menuId === selectedMenu.menuId
              ? "border-orange-600 text-neutral-950"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          on:click={() => (selectedMenuId = menu.menuId)}
        >
          <span class="block text-sm font-medium">{menu.name}</span>
          <span class="block text-xs text-neutral-400">
            {menu.items.length} item{menu.items.length === 1 ? "" : "s"}
          </span>
        </button>
      {/each}
    </nav>

    <section class="bg-white p-6 shadow-sm">
      <div class="space-y-2 border-b border-neutral-100 pb-5">
        <p class="text-xs font-medium uppercase tracking-[0.12em] text-orange-600">Active menu</p>
        <h2 class="text-2xl font-medium tracking-tight text-neutral-950">{selectedMenu.name}</h2>
        <p class="text-base text-neutral-600">{selectedMenu.description}</p>
      </div>

      <div class="divide-y divide-neutral-100">
        {#each selectedMenu.items as item}
          <article class="flex items-center justify-between gap-4 py-4">
            <div class="min-w-0">
              <h3 class="truncate text-base font-medium text-neutral-950">{item.name}</h3>
              <p class="truncate text-sm text-neutral-500">{item.tags.join(" · ") || "No tags"}</p>
            </div>
            <strong class="shrink-0 text-sm font-medium text-orange-700">${item.price.toFixed(2)}</strong>
          </article>
        {:else}
          <div class="py-8">
            <h3 class="text-base font-medium text-neutral-950">No items yet</h3>
            <p class="mt-1 text-neutral-600">Ask the agent to add items to this menu.</p>
            <a class="mt-4 inline-flex bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700" href="/agent">
              Open agent
            </a>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</section>
