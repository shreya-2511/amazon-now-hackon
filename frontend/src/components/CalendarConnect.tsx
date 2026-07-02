"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import type { UseGoogleCalendarReturn } from "@/lib/useGoogleCalendar";

interface Props {
  gcal: UseGoogleCalendarReturn;
  onRefresh?: () => void;
  compact?: boolean;
}

export default function CalendarConnect({
  gcal,
  onRefresh,
  compact = false,
}: Props) {
  const {
    state,
    errorMsg,
    connect,
    disconnect,
    refresh,
    isLoading,
  } = gcal;

  if (state === "no_credentials" || state === "idle") return null;

  const handleRefresh = async () => {
    await refresh();
    onRefresh?.();
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
      >
        {/* ---------------- Error ---------------- */}
        {(state === "error" || errorMsg) && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />

            <div className="flex-1">
              <p className="text-[12px] font-semibold text-red-700">
                {errorMsg ?? "Unable to connect Calendar"}
              </p>
            </div>

            <button
              onClick={connect}
              className="text-[12px] font-semibold text-red-600 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ---------------- Compact Profile UI ---------------- */}
        {compact && !errorMsg && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">

              {state === "connected" ? (
                <div className="">
                </div>
              ) : (
                <div className="flex flex-row gap-2">
               <div>                 <p className="text-[12px] font-semibold text-amzn-dark">
                ✨ What you'll get
              </p>
                    <ul className="mt-3 space-y-2 text-[11px] text-ink2">
                    <li>• Dinner party grocery suggestions</li>
                    <li>• Guest arrival essentials</li>
                    <li>• Automatic NextBuy recommendations</li>
                  </ul>
                  </div>
                <button
                  onClick={connect}
                  disabled={isLoading || state === "checking"}
                  className="rounded-full bg-amzn-yellow2 px-4 mb-15 text-[12px] font-semibold text-amzn-dark transition hover:brightness-95 disabled:opacity-50"
                >
                  {isLoading || state === "checking" ? (
                    <span className="flex items-center gap-2">
                      <Loader2
                        size={13}
                        className="animate-spin"
                      />
                      Connecting...
                    </span>
                  ) : (
                    "Connect"
                  )}
                </button>
                </div>
              )}
            </div>

            {/* Benefits */}

            {/* Connected actions */}
            {state === "connected" && (
              <div className=" flex gap-5">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-gray-400 py-2 text-[12px] font-semibold transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2
                        size={13}
                        className="animate-spin"
                      />
                      Refreshing
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Refresh
                    </span>
                  )}
                </button>

                <button
                  onClick={disconnect}
                  disabled={isLoading}
                  className="flex-1 rounded-xl bg-red-50 py-1 text-[12px] border border-red-600 font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    Disconnect
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------------- Original UI ---------------- */}
        {!compact && !errorMsg && (
          <>
            {state === "connected" ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                <CheckCircle2
                  size={16}
                  className="text-emerald-600 shrink-0"
                />

                <p className="flex-1 text-[12px] font-semibold text-emerald-800">
                  Google Calendar connected
                </p>

                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                </button>

                <button
                  onClick={disconnect}
                  disabled={isLoading}
                  className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-100 text-emerald-700 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                >
                  <Unlink size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isLoading || state === "checking"}
                className="w-full rounded-2xl border border-line bg-white p-4 text-left transition hover:shadow-md disabled:opacity-50"
              >
                <div className="flex items-center gap-3 mb-3">
                  {isLoading ? (
                    <Loader2
                      size={24}
                      className="animate-spin text-amzn-orange"
                    />
                  ) : (
                    <div className="p-2 rounded-xl bg-amzn-orange/10">
                      <Calendar
                        size={20}
                        className="text-amzn-orange"
                      />
                    </div>
                  )}

                  <p className="text-[14px] font-bold">
                    Smart Event Planning
                  </p>
                </div>
                
                <p className="text-[12px] text-ink2 mb-4">
                  Never miss groceries for upcoming events.
                </p>

                <div className="w-full rounded-xl bg-orange-50 p-3">
                  <span className="block text-center text-[13px] font-bold text-amzn-orange">
                    Connect
                  </span>
                </div>
              </button>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}