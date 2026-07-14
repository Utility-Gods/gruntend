<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { Utensils } from "@lucide/svelte";
  import {
    getCustomers,
    getMenusWithItems,
    getOrders,
    getUsers,
  } from "$lib/remote/example.remote";
  import type { Snippet } from "svelte";

  type NavItem = {
    readonly href: string;
    readonly label: string;
    readonly count?: number;
  };

  type Props = {
    readonly children?: Snippet;
  };

  const customersResponse = $derived(getCustomers().current);
  const menusResponse = $derived(getMenusWithItems().current);
  const ordersResponse = $derived(getOrders().current);
  const usersResponse = $derived(getUsers().current);
  const navItems = $derived<NavItem[]>([
    { href: `${base}/`, label: "Overview" },
    {
      href: `${base}/menus`,
      label: "Menus",
      count: menusResponse?.menus.length,
    },
    {
      href: `${base}/orders`,
      label: "Orders",
      count: ordersResponse?.orders.length,
    },
    {
      href: `${base}/customers`,
      label: "Customers",
      count: customersResponse?.customers.length,
    },
    {
      href: `${base}/users`,
      label: "Staff",
      count: usersResponse?.users.length,
    },
  ]);

  let { children }: Props = $props();

  function isActive(href: string) {
    const pathname = page.url.pathname;
    return href === `${base}/`
      ? pathname === `${base}/`
      : pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<div class="flex min-h-screen flex-col bg-[#f7f6f3] text-neutral-900">
  <header
    class="border-b border-primary-200 bg-white shadow-[0_1px_0_rgba(245,74,0,0.05)]"
  >
    <div
      class="mx-auto flex h-16 max-w-6xl items-stretch justify-between px-4 md:px-5"
    >
      <a
        class="flex items-center gap-3"
        href={`${base}/`}
        aria-label="Juniper home"
      >
        <Utensils
          class="shrink-0 text-primary-600"
          size={24}
          strokeWidth={2.4}
        />
        <span>
          <strong
            class="block text-sm font-bold tracking-[-0.025em] text-slate-950"
            >Juniper</strong
          >
          <span
            class="block text-[10px] font-medium tracking-wide text-neutral-500"
            >Restaurant manager</span
          >
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
            {#if item.count !== undefined}
              <span
                class="ml-1.5 hidden min-w-5 bg-neutral-100 px-1.5 py-0.5 text-center text-[10px] tabular-nums text-neutral-600 sm:inline-block"
              >
                {item.count}
              </span>
            {/if}
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
    <div
      class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-4 text-xs text-neutral-500 md:px-5"
    >
      <p>
        Powered by
        <a
          class="font-semibold text-slate-700 hover:text-primary-600"
          href="https://gruntend.com/"
          target="_blank"
          rel="noreferrer">Gruntend</a
        >
      </p>
      <a
        class="inline-flex items-center gap-1.5 font-medium text-neutral-600 hover:text-primary-600"
        href="https://www.npmjs.com/package/gruntend-sdk"
        target="_blank"
        rel="noreferrer"
      >
        <img class="h-2.5 w-auto" src="/npm.svg" alt="" />
        gruntend-sdk
      </a>
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
