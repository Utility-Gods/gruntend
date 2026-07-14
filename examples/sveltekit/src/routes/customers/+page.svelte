<script lang="ts">
  import LoadingSurface from "$lib/components/photoship/LoadingSurface.svelte";
  import { ContactRound, Search } from "@lucide/svelte";
  import {
    getCustomers,
    getOrders,
    getReservations,
  } from "$lib/remote/example.remote";

  const customersResponse = $derived(getCustomers().current);
  const ordersResponse = $derived(getOrders().current);
  const reservationsResponse = $derived(getReservations().current);
  const customers = $derived(customersResponse?.customers ?? []);
  const orders = $derived(ordersResponse?.orders ?? []);

  let search = $state("");
  const visibleCustomers = $derived(
    customers.filter((customer) => {
      const query = search.trim().toLowerCase();
      return (
        !query ||
        customer.name.toLowerCase().includes(query) ||
        customer.loyaltyTier.toLowerCase().includes(query)
      );
    }),
  );

  function customerOrders(customerId: string) {
    return orders.filter((order) => order.customerId === customerId);
  }

  function reservationCount(customerId: string) {
    return (reservationsResponse?.reservations ?? []).filter(
      (reservation) => reservation.customerId === customerId,
    ).length;
  }

  function paidSpend(customerId: string) {
    return customerOrders(customerId).reduce(
      (total, order) =>
        total + (order.payment?.status === "paid" ? order.payment.amount : 0),
      0,
    );
  }
</script>

<section class="space-y-5">
  <header
    class="flex flex-col justify-between gap-3 py-1 sm:flex-row sm:items-center"
  >
    <div class="flex items-center gap-3">
      <ContactRound
        class="shrink-0 text-primary-600"
        size={23}
        strokeWidth={2.2}
      />
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-slate-950">
          Customers
        </h1>
        <p class="mt-0.5 text-xs text-neutral-500">
          {customers.length} sample customer records · activity calculated from D1
          orders
        </p>
      </div>
    </div>
    <label class="relative block w-full sm:w-72">
      <span class="sr-only">Search customers</span>
      <Search
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        size={16}
      />
      <input
        bind:value={search}
        class="h-10 w-full border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        placeholder="Name or loyalty tier"
      />
    </label>
  </header>

  {#if !customersResponse || !ordersResponse || !reservationsResponse}
    <LoadingSurface
      label="Loading customers and order activity from D1..."
      rows={5}
    />
  {:else}
    <section
      class="overflow-hidden border border-neutral-200 bg-white shadow-sm"
    >
      <div
        class="hidden grid-cols-[1.3fr_110px_90px_110px_130px] border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:grid"
      >
        <span>Customer</span>
        <span>Loyalty</span>
        <span>Orders</span>
        <span>Reservations</span>
        <span>Paid spend</span>
      </div>
      {#each visibleCustomers as customer}
        <article
          class="grid gap-3 border-b border-neutral-100 px-5 py-4 last:border-b-0 sm:grid-cols-[1.3fr_110px_90px_110px_130px] sm:items-center"
        >
          <div>
            <h2 class="text-sm font-semibold text-slate-950">
              {customer.name}
            </h2>
            <p class="mt-0.5 text-xs text-neutral-500">
              {customer.email} · since {new Date(
                customer.createdAt,
              ).toLocaleDateString()}
            </p>
          </div>
          <span class="text-xs font-semibold capitalize text-primary-700"
            >{customer.loyaltyTier}</span
          >
          <span class="text-sm tabular-nums text-neutral-700"
            >{customerOrders(customer.customerId).length}</span
          >
          <span class="text-sm tabular-nums text-neutral-700"
            >{reservationCount(customer.customerId)}</span
          >
          <strong class="text-sm tabular-nums text-slate-950"
            >${paidSpend(customer.customerId).toFixed(2)}</strong
          >
        </article>
      {:else}
        <p class="p-6 text-sm text-neutral-500">
          No customers match this search.
        </p>
      {/each}
    </section>
  {/if}
</section>
