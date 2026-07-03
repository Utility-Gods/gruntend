<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import Badge from "$lib/components/photoship/Badge.svelte";

  type NavItem = {
    readonly href: string;
    readonly label: string;
    readonly icon: string;
    readonly badge?: string;
  };

  type Props = {
    readonly children?: Snippet;
  };

  const navItems: NavItem[] = [
    { href: "/", label: "Home", icon: "⌂" },
    { href: "/agent", label: "Agent", icon: "✦", badge: "AI" },
    { href: "/menus", label: "Menus", icon: "☰" },
    { href: "/users", label: "Users", icon: "◉" },
  ];

  let { children }: Props = $props();

  function isActive(href: string) {
    const pathname = page.url.pathname;
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  function pageTitle() {
    const pathname = page.url.pathname;
    if (pathname.startsWith("/agent")) return "Agent run";
    if (pathname.startsWith("/menus/")) return "Menu detail";
    if (pathname.startsWith("/menus")) return "Menus";
    if (pathname.startsWith("/users")) return "Users";
    return "Dashboard";
  }

  function pageSubtitle() {
    const pathname = page.url.pathname;
    if (pathname.startsWith("/agent")) return "Generate code plans and execute them through app-owned tools.";
    if (pathname.startsWith("/menus")) return "Restaurant data served by API routes and Gruntend handlers.";
    if (pathname.startsWith("/users")) return "Team records exposed to the tool namespace.";
    return "SvelteKit app + OpenAI planning + Gruntend runtime boundary.";
  }
</script>

<div class="ps-app-shell uk-theme-photoship">
  <aside class="ps-sidebar" aria-label="Application navigation">
    <a class="ps-logo" href="/" aria-label="Gruntend Kitchen home">
      <span class="ps-logo-mark">G</span>
      <span><strong>GRUNT</strong><em>END</em></span>
    </a>

    <nav class="ps-nav">
      {#each navItems as item}
        <a class:active={isActive(item.href)} href={item.href}>
          <span class="ps-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
          {#if item.badge}<Badge variant="primary" class="ml-auto">{item.badge}</Badge>{/if}
        </a>
      {/each}
    </nav>

    <div class="ps-sidebar-footer">
      <div class="ps-org-avatar">GK</div>
      <div>
        <strong>Kitchen Ops</strong>
        <span>Example workspace</span>
      </div>
    </div>
  </aside>

  <div class="ps-main">
    <header class="ps-topbar">
      <div class="ps-topbar-title">
        <span class="ps-header-icon">✦</span>
        <div>
          <h1>{pageTitle()}</h1>
          <p>{pageSubtitle()}</p>
        </div>
      </div>
      <div class="ps-topbar-actions">
        <Badge variant="secondary">SvelteKit</Badge>
        <Badge variant="primary">OpenAI via pi-ai</Badge>
      </div>
    </header>

    <main class="ps-content">
      <div class="ps-content-inner">
        {@render children?.()}
      </div>
    </main>
  </div>
</div>
