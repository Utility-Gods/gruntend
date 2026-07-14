<script lang="ts">
  import LoadingSurface from "$lib/components/photoship/LoadingSurface.svelte";
  import { UsersRound } from "@lucide/svelte";
  import { getOrders, getShifts, getUsers } from "$lib/remote/example.remote";

  const usersResponse = $derived(getUsers().current);
  const ordersResponse = $derived(getOrders().current);
  const shiftsResponse = $derived(getShifts().current);
  const users = $derived(usersResponse?.users ?? []);
  const orders = $derived(ordersResponse?.orders ?? []);
  const shifts = $derived(shiftsResponse?.shifts ?? []);

  function assignedOrders(userId: string) {
    return orders.filter((order) => order.assignedUserId === userId);
  }

  function paidSales(userId: string) {
    return assignedOrders(userId).reduce(
      (total, order) =>
        total + (order.payment?.status === "paid" ? order.payment.amount : 0),
      0,
    );
  }

  function scheduledHours(userId: string) {
    return shifts
      .filter((shift) => shift.userId === userId)
      .reduce(
        (total, shift) =>
          total +
          (Date.parse(shift.endsAt) - Date.parse(shift.startsAt)) / 3_600_000,
        0,
      );
  }
</script>

<section class="space-y-5">
  <header class="flex min-w-0 items-center gap-3 py-1">
    <UsersRound class="shrink-0 text-primary-600" size={23} strokeWidth={2.2} />
    <div class="min-w-0">
      <h1 class="text-xl font-semibold tracking-tight text-slate-950">
        Restaurant staff
      </h1>
      <p class="mt-0.5 text-xs text-neutral-500">
        Assignments and sales are calculated from the same D1 order
        relationships
      </p>
    </div>
  </header>

  {#if !usersResponse || !ordersResponse || !shiftsResponse}
    <LoadingSurface label="Loading staff operations from D1..." rows={6} />
  {:else}
    <section
      class="overflow-hidden border border-neutral-200 bg-white shadow-sm"
    >
      <div
        class="hidden grid-cols-[1.3fr_120px_100px_120px_120px] border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 md:grid"
      >
        <span>Name</span>
        <span>Role</span>
        <span>Orders</span>
        <span>Paid sales</span>
        <span>Shift hours</span>
      </div>
      {#each users as user}
        <article
          class="grid gap-3 border-b border-neutral-100 px-4 py-4 last:border-b-0 md:grid-cols-[1.3fr_120px_100px_120px_120px] md:items-center md:px-5"
        >
          <h2 class="text-sm font-semibold text-slate-950">{user.name}</h2>
          <div class="flex items-center justify-between md:block">
            <span class="text-xs font-medium text-neutral-500 md:hidden"
              >Role</span
            >
            <span class="text-sm font-medium capitalize text-primary-700"
              >{user.role}</span
            >
          </div>
          <div class="flex items-center justify-between md:block">
            <span class="text-xs font-medium text-neutral-500 md:hidden"
              >Orders</span
            >
            <span class="text-sm tabular-nums text-neutral-700"
              >{assignedOrders(user.userId).length}</span
            >
          </div>
          <div class="flex items-center justify-between md:block">
            <span class="text-xs font-medium text-neutral-500 md:hidden"
              >Paid sales</span
            >
            <span class="text-sm tabular-nums text-neutral-700"
              >${paidSales(user.userId).toFixed(2)}</span
            >
          </div>
          <div class="flex items-center justify-between md:block">
            <span class="text-xs font-medium text-neutral-500 md:hidden"
              >Shift hours</span
            >
            <span class="text-sm tabular-nums text-neutral-700"
              >{scheduledHours(user.userId).toFixed(1)}h</span
            >
          </div>
        </article>
      {/each}
    </section>
  {/if}
</section>
