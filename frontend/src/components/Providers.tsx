"use client";
import { BootProvider } from "@/lib/boot";
import { CartProvider } from "@/lib/cart";
import PhoneFrame from "./PhoneFrame";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BootProvider>
      <CartProvider>
        <PhoneFrame>{children}</PhoneFrame>
      </CartProvider>
    </BootProvider>
  );
}
