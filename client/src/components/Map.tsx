import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: unknown) => void;
}

/**
 * Maps are intentionally disabled until a server-side proxy is configured.
 * Never put provider keys or session tokens in the browser bundle.
 */
export function MapView({ className }: MapViewProps) {
  return (
    <div
      className={cn("flex min-h-[180px] items-center justify-center rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground", className)}
      role="status"
      aria-label="Map unavailable"
    >
      Map integration is unavailable until a server-side provider proxy is configured.
    </div>
  );
}

export default MapView;

