<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { Utensils } from "lucide-svelte";
  import type { Snippet } from "svelte";

  type NavItem = {
    readonly href: string;
    readonly label: string;
  };

  type Props = {
    readonly children?: Snippet;
  };

  const navItems: NavItem[] = [
    { href: `${base}/`, label: "Overview" },
    { href: `${base}/menus`, label: "Menus" },
    { href: `${base}/users`, label: "Staff" },
  ];

  let { children }: Props = $props();

  function isActive(href: string) {
    const pathname = page.url.pathname;
    return href === `${base}/`
      ? pathname === `${base}/`
      : pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<div class="flex min-h-screen flex-col bg-[#f7f6f3] text-neutral-900">
  <header class="border-b border-primary-200 bg-white shadow-[0_1px_0_rgba(245,74,0,0.05)]">
    <div class="mx-auto flex h-16 max-w-6xl items-stretch justify-between px-4 md:px-5">
      <a class="flex items-center gap-3" href={`${base}/`} aria-label="Juniper home">
        <Utensils class="shrink-0 text-primary-600" size={24} strokeWidth={2.4} />
        <span>
          <strong class="block text-sm font-bold tracking-[-0.025em] text-slate-950">Juniper</strong>
          <span class="block text-[10px] font-medium tracking-wide text-neutral-500">Restaurant manager</span>
        </span>
      </a>

      <nav class="flex items-stretch gap-2" aria-label="Application navigation">
        {#each navItems as item}
          <a
            class={`flex items-center border-b-[3px] px-3 pt-0.5 text-sm font-semibold transition ${
              isActive(item.href)
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-neutral-500 hover:border-primary-600 hover:text-primary-600"
            }`}
            href={item.href}
          >
            {item.label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main class="flex-1 px-4 py-5 md:px-5 md:py-6">
    <div class="mx-auto max-w-6xl">
      {@render children?.()}
    </div>
  </main>

  <footer class="border-t border-neutral-200 bg-white">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-4 text-xs text-neutral-500 md:px-5">
      <p>
        Powered by
        <a class="font-semibold text-slate-700 hover:text-primary-600" href="https://gruntend.com/" target="_blank" rel="noreferrer">Gruntend</a>
      </p>
      <a
        class="inline-flex items-center gap-1.5 font-medium text-neutral-600 hover:text-primary-600"
        href="https://github.com/Utility-Gods/gruntend"
        target="_blank"
        rel="noreferrer"
        aria-label="View Gruntend on GitHub"
      >
        <img class="h-3.5 w-3.5" src="/github.svg" alt="" />
        GitHub
      </a>
    </div>
  </footer>
</div>
