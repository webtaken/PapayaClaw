"use client";

import { useState } from "react";
import { InstanceCard } from "./instance-card";
import { DeployDialog } from "./deploy-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export interface Instance {
  id: string;
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function DashboardContent({
  initialInstances,
}: {
  initialInstances: Instance[];
}) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [deployOpen, setDeployOpen] = useState(false);

  const handleInstanceCreated = (newInstance: Instance) => {
    setInstances((prev) => [newInstance, ...prev]);
    setDeployOpen(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/instances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInstances((prev) =>
        prev.map((inst) => (inst.id === id ? updated : inst)),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/instances/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setInstances((prev) => prev.filter((inst) => inst.id !== id));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Your Instances
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage and monitor your OpenClaw deployments
          </p>
        </div>
        <Button
          onClick={() => setDeployOpen(true)}
          className="cursor-pointer gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg transition-all duration-300 hover:bg-zinc-100 hover:shadow-xl"
        >
          <Plus className="h-4 w-4" />
          Deploy New Instance
        </Button>
      </div>

      {/* Instance Grid */}
      {instances.length === 0 ? (
        <button
          onClick={() => setDeployOpen(true)}
          className="group mx-auto flex w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/30 px-8 py-16 transition-all duration-300 hover:border-violet-500/30 hover:bg-violet-500/5"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
            <Plus className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            Deploy your first OpenClaw instance
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            Click here to get started in under 1 minute
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Deploy Dialog */}
      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        onInstanceCreated={handleInstanceCreated}
      />
    </div>
  );
}
