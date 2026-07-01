"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params.code || "").toUpperCase();
  const [status, setStatus] = useState("Joining…");

  useEffect(() => {
    async function run() {
      // Already in this room?
      const existing = localStorage.getItem(`mafia:${code}:token`);
      if (existing) {
        router.replace(`/room/${code}`);
        return;
      }
      const authToken = localStorage.getItem("mafia:auth");
      if (!authToken) {
        setStatus("Please sign in first. Redirecting…");
        localStorage.setItem("mafia:pendingJoin", code);
        setTimeout(() => router.replace("/"), 1200);
        return;
      }
      try {
        const res = await fetch(`/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        localStorage.setItem(`mafia:${code}:token`, data.token);
        router.replace(`/room/${code}`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to join");
      }
    }
    run();
  }, [code, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-950 via-slate-900 to-black px-5 text-center text-slate-100">
      <div>
        <div className="text-5xl">🕵️‍♂️</div>
        <h1 className="mt-2 text-2xl font-black text-amber-400">Mafia Invite</h1>
        <div className="mt-1 text-4xl font-black tracking-[0.3em] text-amber-400">{code}</div>
        <p className="mt-4 text-slate-300">{status}</p>
        <button onClick={() => router.push("/")} className="mt-4 text-sm text-slate-500 underline">
          Back home
        </button>
      </div>
    </main>
  );
}
