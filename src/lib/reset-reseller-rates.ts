type RateDeleteClient = {
  from: (table: "reseller_product_prices") => {
    delete: () => { eq: (column: "reseller_id", value: string) => PromiseLike<{ error: { message: string } | null }> };
  };
};

/** Remove overrides, not master values or saved order snapshots. */
export async function resetResellerRates(client: RateDeleteClient, resellerId: string) {
  if (!resellerId.trim()) throw new Error("Select a reseller first");
  const { error } = await client.from("reseller_product_prices").delete().eq("reseller_id", resellerId);
  if (error) throw new Error(error.message);
}