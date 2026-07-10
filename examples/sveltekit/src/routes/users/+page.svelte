<script lang="ts">
  import { getUsers } from "$lib/remote/example.remote";

  const usersResponse = $derived(getUsers().current);
  const users = $derived(usersResponse?.users ?? []);
</script>

<section class="space-y-8">
  <header class="max-w-3xl space-y-3">
    <p
      class="text-sm font-semibold uppercase tracking-[0.12em] text-orange-600"
    >
      Team
    </p>
    <h1
      class="text-3xl font-medium tracking-tight text-neutral-950 md:text-2xl"
    >
      Team members
    </h1>
    <p class="text-base leading-7 text-neutral-600">
      People available to the restaurant tools and agent workflows.
    </p>
  </header>

  <section class="overflow-hidden border border-neutral-200 bg-white">
    <div
      class="grid grid-cols-[1fr_160px] border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500"
    >
      <span>Name</span>
      <span>Role</span>
    </div>
    {#each users as user}
      <article
        class="grid grid-cols-[1fr_160px] items-center border-b border-neutral-100 px-5 py-4 last:border-b-0"
      >
        <h2 class="text-lg font-semibold text-neutral-950">{user.name}</h2>
        <span class="capitalize text-neutral-600">{user.role}</span>
      </article>
    {/each}
  </section>
</section>
