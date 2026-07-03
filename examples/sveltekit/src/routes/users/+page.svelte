<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="page-heading">
  <p class="eyebrow">Users</p>
  <h1>Team members</h1>
  <p>Seeded users available through the app API and Gruntend tools.</p>
</section>

<section class="grid">
  {#each data.users as user}
    <article class="panel user-card">
      <p class="muted">{user.userId}</p>
      <h2>{user.name}</h2>
      <span>{user.role}</span>
    </article>
  {/each}
</section>

<style>
  .page-heading {
    margin-bottom: 2rem;
  }

  .user-card h2 {
    margin-bottom: 0.75rem;
  }

  .user-card span {
    display: inline-flex;
    border-radius: 999px;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 0.35rem 0.7rem;
    line-height: 1.2;
    text-transform: capitalize;
  }
</style>
