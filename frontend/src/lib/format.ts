export const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const SIGNAL_BADGE: Record<string, { label: string; cls: string }> = {
  calendar: { label: "Calendar", cls: "bg-amzn-purple/10 text-amzn-purple" },
  fridge: { label: "Fridge", cls: "bg-sky-100 text-sky-700" },
  history: { label: "Reorder", cls: "bg-amber-100 text-amber-700" },
};
