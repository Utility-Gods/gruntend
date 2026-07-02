<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="page-heading">
  <p class="eyebrow">Menus</p>
  <h1>Restaurant menus</h1>
  <p>Normal application route reading seeded data from <code>/api/menus</code>.</p>
</section>

<section class="grid">
  {#each data.menus as menu}
    <article class="panel menu-card">
      <p class="muted">{menu.menuId}</p>
      <h2>{menu.name}</h2>
      <p>{menu.description}</p>
      <a class="button" href={`/menus/${menu.menuId}`}>View items</a>
    </article>
  {/each}
</section>

<style>
  .page-heading {
    margin-bottom: 24px;
  }

  code {
    color: #bae6fd;
  }

  .menu-card h2 {
    margin-bottom: 8px;
  }

  .menu-card .button {
    margin-top: 10px;
  }
</style>
