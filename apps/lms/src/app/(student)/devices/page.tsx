"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";
import { Monitor, Smartphone, Clock, MapPin, Shield, AlertCircle } from "lucide-react";

interface TrustedDevice {
  deviceType: string;
  deviceName: string;
  os: string;
  browser: string;
  linkedAt: string;
  lastLoginAt?: string;
  lastLoginCity?: string;
}

interface PendingRequest {
  _id: string;
  deviceType: string;
  newDeviceName: string;
  status: string;
  createdAt: string;
}

interface DeviceData {
  devices: TrustedDevice[];
  pendingRequests: PendingRequest[];
}

export default function TrustedDevicesPage() {
  const [data, setData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DeviceData>("/api/student/devices")
      .then((r) => { if (r.success && r.data) setData(r.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AppPageShell><div className="flex min-h-[300px] items-center justify-center"><div className="spinner" /></div></AppPageShell>;

  const desktop = data?.devices.find((d) => d.deviceType === "DESKTOP");
  const mobile = data?.devices.find((d) => d.deviceType === "MOBILE");
  const pending = data?.pendingRequests ?? [];

  return (
    <AppPageShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trusted Devices</h1>
          <p className="mt-1 text-sm text-slate-500">Your registered devices for secure access to FUNT Learn.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Desktop */}
          <DeviceCard
            icon={<Monitor className="h-5 w-5" />}
            label="Laptop / Desktop"
            device={desktop}
          />
          {/* Mobile */}
          <DeviceCard
            icon={<Smartphone className="h-5 w-5" />}
            label="Mobile Device"
            device={mobile}
          />
        </div>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertCircle className="h-4 w-4" /> Device Change Requests
            </p>
            <div className="space-y-2">
              {pending.map((req) => (
                <div key={req._id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{req.newDeviceName}</p>
                    <p className="text-xs text-slate-500">{req.deviceType} · Requested {new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    Pending Approval
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Shield className="h-3.5 w-3.5 text-indigo-500" /> Security Policy
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            <li>• 1 registered desktop/laptop and 1 registered mobile are allowed.</li>
            <li>• Only Admin can approve device changes for your security.</li>
            <li>• Devices on FUNT office Wi-Fi have unlimited access.</li>
            <li>• Only one active session is allowed at a time.</li>
          </ul>
        </div>
      </div>
    </AppPageShell>
  );
}

function DeviceCard({ icon, label, device }: { icon: React.ReactNode; label: string; device?: TrustedDevice }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <span className="text-sm font-semibold text-slate-800">{label}</span>
      </div>
      {device ? (
        <div className="space-y-2">
          <InfoRow icon={<Monitor className="h-3 w-3" />} label="Device" value={device.deviceName} />
          <InfoRow icon={<Shield className="h-3 w-3" />} label="OS" value={device.os} />
          <InfoRow icon={<Clock className="h-3 w-3" />} label="Linked" value={new Date(device.linkedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
          {device.lastLoginAt && (
            <InfoRow icon={<Clock className="h-3 w-3" />} label="Last Login" value={new Date(device.lastLoginAt).toLocaleString()} />
          )}
          {device.lastLoginCity && (
            <InfoRow icon={<MapPin className="h-3 w-3" />} label="Last City" value={device.lastLoginCity} />
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Not registered yet. Will be set on first login from this device type.</p>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400">{icon}</span>
      <span className="w-16 text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
