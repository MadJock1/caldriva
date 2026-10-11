"use client";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Polygon, useMap, useMapEvents, Marker } from "react-leaflet";
import { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/building";

function MapEvents({ center, onClick, enabled }: { center: MapPoint; onClick: (point: MapPoint) => void; enabled: boolean }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 19, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, duration: 0.4 }); }, [map, center]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useMapEvents({ click: e => { if (enabled) onClick([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

function BuildingMarker({ center, confirmed }: { center: MapPoint; confirmed: boolean }) {
  const icon = useMemo(() => new DivIcon({
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${confirmed ? "#08776c" : "#17364A"};border:3px solid #F4F7FA;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#F4F7FA;font-weight:bold;font-size:12px;">${confirmed ? "✓" : ""}</div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }), [confirmed]);
  return <Marker position={center} icon={icon} interactive={false} />;
}

export interface RoofMapProps {
  center: MapPoint;
  roof: MapPoint[];
  onClick: (p: MapPoint) => void;
  markerOnly?: boolean;
  locationConfirmed?: boolean;
}

export default function RoofMap({ center, roof, onClick, markerOnly = false, locationConfirmed = false }: RoofMapProps) {
  return (
    <MapContainer center={center} zoom={19} className="h-[430px] w-full rounded-xl z-0" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <MapEvents center={center} onClick={onClick} enabled={true} />
      <BuildingMarker center={center} confirmed={locationConfirmed} />
      {!markerOnly && roof.length >= 3 && <Polygon positions={roof} pathOptions={{ color: "#08776c", fillColor: "#65DFD0", fillOpacity: 0.3 }} />}
      {!markerOnly && roof.map((point, i) => <CircleMarker key={i} center={point} radius={4} pathOptions={{ color: "#08776c", fillColor: "#65DFD0", fillOpacity: 1 }} />)}
    </MapContainer>
  );
}
