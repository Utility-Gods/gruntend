<script lang="ts">
  import { page } from "$app/state";
  import "../app.css";

  let { children } = $props();

  const navItems = [
    { href: "/agent", label: "Agent" },
    { href: "/menus", label: "Menus" },
    { href: "/users", label: "Team" },
  ];

  function isActive(href: string) {
    const pathname = page.url.pathname;
    return pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<svelte:head>
  <title>Gruntend Kitchen</title>
</svelte:head>

<div class="min-h-screen bg-[#fafafa] text-neutral-900">
  <header class="border-b border-neutral-200 bg-white">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
      <a class="text-base font-medium tracking-tight text-neutral-950" href="/agent">Gruntend</a>

      <nav class="flex items-center gap-1" aria-label="Application navigation">
        {#each navItems as item}
          <a
            class={`px-3 py-2 text-sm transition ${
              isActive(item.href)
                ? "text-orange-700"
                : "text-neutral-500 hover:text-neutral-950"
            }`}
            href={item.href}
          >
            {item.label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main class="px-5 py-8">
    <div class="mx-auto max-w-5xl">
      {@render children()}
    </div>
  </main>
</div>
