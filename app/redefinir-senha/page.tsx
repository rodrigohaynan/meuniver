import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ResetPasswordCard } from "@/components/reset-password-card";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#f8f4f1]">
      <div className="mx-auto w-full max-w-[720px] px-4 py-5 sm:px-6 lg:py-8">
        <header className="mb-5">
          <Link href="/" className="inline-flex w-fit items-center">
            <BrandMark />
          </Link>
        </header>

        <ResetPasswordCard />
      </div>
    </main>
  );
}
