<script lang="ts">
  import LoadingSurface from "$lib/components/photoship/LoadingSurface.svelte";
  import { UsersRound } from "lucide-svelte";
  import { getUsers } from "$lib/remote/example.remote";

  const usersResponse = $derived(getUsers().current);
  const users = $derived(usersResponse?.users ?? []);
</script>

<section class="space-y-5">
  <header class="flex items-center gap-3 py-1">
    <UsersRound class="shrink-0 text-primary-600" size={23} strokeWidth={2.2} />
    <h1 class="text-xl font-semibold tracking-tight text-slate-950">
      Restaurant staff
    </h1>
  </header>

  {#if !usersResponse}
    <LoadingSurface
      label="Loading team members from the demo database..."
      rows={3}
    />
  {:else}
    <section
      class="overflow-hidden border border-neutral-200 bg-white shadow-sm"
    >
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
          <div>
            <h2 class="text-sm font-semibold text-slate-950">{user.name}</h2>
          </div>
          <span class="text-sm font-medium capitalize text-primary-700"
            >{user.role}</span
          >
        </article>
      {/each}
    </section>
  {/if}
</section>
