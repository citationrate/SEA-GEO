import { VoucherClient } from "./voucher-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voucher" };

export default function VoucherAdminPage() {
  return <VoucherClient />;
}
