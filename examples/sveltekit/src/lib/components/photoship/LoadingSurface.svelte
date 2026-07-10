<script lang="ts">
  type Props = {
    readonly label?: string;
    readonly rows?: number;
  };

  let { label = "Loading...", rows = 4 }: Props = $props();
</script>

<section class="bg-white p-6 shadow-sm" aria-busy="true" aria-live="polite">
  <div class="space-y-5">
    <div class="space-y-2 border-b border-neutral-100 pb-5">
      <div class="h-3 w-24 animate-pulse bg-orange-100"></div>
      <div class="h-7 w-52 animate-pulse bg-neutral-200"></div>
      <div class="h-4 w-full max-w-md animate-pulse bg-neutral-100"></div>
    </div>

    <div class="space-y-4">
      {#each Array.from({ length: rows }) as _}
        <div class="flex items-center justify-between gap-4 py-2">
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-4 w-48 animate-pulse bg-neutral-200"></div>
            <div class="h-3 w-64 max-w-full animate-pulse bg-neutral-100"></div>
          </div>
          <div class="h-4 w-16 shrink-0 animate-pulse bg-orange-100"></div>
        </div>
      {/each}
    </div>
  </div>

  <p class="mt-5 text-sm text-neutral-500">{label}</p>
</section>
