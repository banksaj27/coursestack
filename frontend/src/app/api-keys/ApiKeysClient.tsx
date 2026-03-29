"use client";

import { motion } from "framer-motion";
import ApiSettingsPanel from "@/components/settings/ApiSettingsPanel";

export default function ApiKeysClient() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8"
    >
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
        >
          <ApiSettingsPanel />
        </motion.div>
      </div>
    </motion.main>
  );
}
