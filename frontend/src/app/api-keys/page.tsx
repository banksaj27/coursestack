import AppNav from "@/components/AppNav";
import ApiKeysClient from "./ApiKeysClient";

export default function ApiKeysPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppNav />
      <ApiKeysClient />
    </div>
  );
}
