import AppNav from "@/components/AppNav";
import AppearanceSettingsPanel from "@/components/settings/AppearanceSettingsPanel";

export default function SettingsPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
      <AppNav />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Settings
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Customize how CourseStack looks on this device.
            </p>
          </div>
          <AppearanceSettingsPanel />
        </div>
      </main>
    </div>
  );
}
