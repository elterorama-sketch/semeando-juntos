import TopBar from "@/components/TopBar";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default function SenhaPage() {
  return (
    <>
      <TopBar title="Alterar senha" />
      <main className="flex-1 p-4 md:p-6">
        <ChangePasswordForm />
      </main>
    </>
  );
}
