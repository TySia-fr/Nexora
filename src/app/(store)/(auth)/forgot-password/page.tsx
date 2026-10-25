import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { emailEnabled } from "@/server/mailer";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-[-0.03em]">Reset password</h1>
      <p className="text-ash">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm emailEnabled={emailEnabled} />
    </>
  );
}
